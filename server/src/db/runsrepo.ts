import { UUID } from '@common/util'
import { IMain, ColumnSet } from 'pg-promise'
import _ from 'lodash'
import { ScorekeeperProtocol } from '.'
import { cleanAttr } from './helper'
import { Run } from '@/common/results'

let runcols: ColumnSet|undefined

export class RunsRepository {
    constructor(private db: ScorekeeperProtocol, private pgp: IMain) {
        if (runcols === undefined) {
            runcols = new pgp.helpers.ColumnSet([
                { name: 'eventid',  cnd: true, cast: 'uuid' },
                { name: 'carid',    cnd: true, cast: 'uuid' },
                { name: 'rungroup', cnd: true },
                { name: 'course',   cnd: true },
                { name: 'run',      cnd: true },
                'raw', 'cones', 'gates', 'status',
                { name: 'attr',     cast: 'json', init: (col: any): any => { return cleanAttr(col.value) } },
                { name: 'modified', cast: 'timestamp', mod: ':raw', init: (): any => { return 'now()' } }
            ], { table: 'runs' })
        }
    }

    async getRuns(eventid: UUID, carid: UUID): Promise<Run[]> {
        return this.db.any('SELECT * FROM runs WHERE eventid=$1 AND carid=$2', [eventid, carid])
    }

    async updateRuns(runs: Run[]): Promise<Run[]> {
        const ret = [] as Run[]
        for (const run of runs) {
            const res = await this.db.oneOrNone(this.pgp.helpers.insert([run], runcols) +
                                    ' ON CONFLICT (eventid,carid,rungroup,course,run) DO UPDATE SET ' +
                                    this.pgp.helpers.sets(run, runcols) + ' RETURNING *')
            if (res) ret.push(res) // null means nothing changed do trigger stopped it
        }
        return ret
    }

    async getLastSet(eventid: UUID, earliest: Date, classcodefilter?: string, coursefilter?: number) {
        // Search through serieslog rather than tables so that we can pick up deletes as well as regular insert/update
        const ret = {} as {[classcode: string]: Run} // , lastEntry: Run&{classcode:string} }
        const args = { earliest, eventid, classcodefilter, coursefilter }

        let filt = ''
        if (classcodefilter) filt += 'AND lower(c.classcode)=lower($(classcodefilter)) '
        if (coursefilter)    filt += "AND (s.newdata->>'course'=$(coursefilter) OR s.olddata->>'course'=$(coursefilter)) "

        const rows = await this.db.any('select s.ltime, c.carid, c.classcode, s.olddata, s.newdata ' +
                        "FROM serieslog s JOIN cars c ON c.carid=uuid(s.newdata->>'carid') OR c.carid=uuid(s.olddata->>'carid') " +
                        "WHERE s.tablen='runs' AND s.ltime > $(earliest) AND (s.newdata->>'eventid'=$(eventid) OR s.olddata->>'eventid'=$(eventid)) " +
                        filt + ' ORDER BY s.ltime', args)

        for (const row of rows) {
            const entry = Object.assign(row.newdata || row.olddata, { classcode: row.classcode, modified: row.ltime })
            ret[row.classcode] = entry
            ret.lastEntry      = entry
        }
        return ret
    }


    async getNextRunOrder(aftercarid: UUID, eventid: UUID, course: number, rungroup: number, classcodefilter?: string, count = 3):
        Promise<Array<{carid: UUID, classcode: string, number: number}>> {

        // Returns a list of objects (classcode, carid) for the next cars in order after carid """
        const order = await this.db.map('SELECT unnest(cars) cid from runorder WHERE eventid=$1 AND course=$2 AND rungroup=$2', [eventid, course, rungroup], r => r.cid)
        const ret = [] as any[]
        for (const [ii, rowid] of order.entries()) {
            if (rowid === aftercarid) {
                for (let jj = 1; jj < order.length; jj++) {
                    const idx = (ii + jj) % order.length
                    const nextinfo = await this.db.one('SELECT c.carid,c.classcode,c.number from cars c WHERE carid=$1', [order[idx]])
                    if (classcodefilter && nextinfo.classcode !== classcodefilter) {
                        continue
                    }
                    ret.push(nextinfo)
                    if (ret.length >= count) break
                }
                break
            }
        }

        return ret
    }

    async attendance(): Promise<{[key: string]: UUID[]}> {
        const rows = await this.db.any('SELECT DISTINCT r.eventid,c.driverid FROM runs r JOIN cars c ON c.carid=r.carid')
        const ret = {}
        for (const row of rows) {
            if (!(row.eventid in ret)) ret[row.eventid] = new Set()
            ret[row.eventid].add(row.driverid)
        }
        for (const eventid in ret) {
            ret[eventid] = Array.from(ret[eventid])
        }
        return ret
    }
}
