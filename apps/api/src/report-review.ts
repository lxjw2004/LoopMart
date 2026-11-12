import {randomUUID} from 'node:crypto';
import type {Pool} from 'pg';
import {fail} from './validation.js';
// Caller supplies the administrator transaction, so review, takedown, jobs and audit commit together.
export async function reviewReport(pool:Pool,id:string,status:string,note:unknown){
 if(!['reviewed','dismissed','violation_confirmed'].includes(status)||typeof note!=='string'||note.length>10000)fail(400,'Invalid review');
 const report=(await pool.query('SELECT * FROM reports WHERE id=$1 FOR UPDATE',[id])).rows[0];if(!report)fail(404,'Report not found');
 let summary=report.target_type+': '+report.target_id;let owner:string|undefined;
 if(['item','ride'].includes(report.target_type)){const target=(await pool.query('SELECT * FROM entities WHERE id=$1 AND kind=$2',[report.target_id,report.target_type])).rows[0];if(target){summary=target.kind==='item'?target.data.title:target.data.origin+' → '+target.data.destination;owner=target.publisher_id;}}
 if(report.target_type==='user'){const target=(await pool.query('SELECT name FROM "user" WHERE id=$1',[report.target_id])).rows[0];if(target)summary=target.name;}
 await pool.query('UPDATE reports SET status=$1,note=$2 WHERE id=$3',[status,note,id]);
 if(status==='violation_confirmed'&&['item','ride'].includes(report.target_type))await pool.query("UPDATE entities SET status='deactivated_violation',updated_at=now() WHERE id=$1 AND kind=$2",[report.target_id,report.target_type]);
 if(report.status===status)return;
 const conclusion:Record<string,string>={reviewed:'已审核 / Reviewed',dismissed:'已驳回 / Dismissed',violation_confirmed:'违规已确认 / Violation confirmed'};
 await pool.query('INSERT INTO notification_jobs(id,payload) VALUES($1,$2)',[randomUUID(),{userId:report.reporter_id,reportId:id,kind:'reporter_status_update',text:`举报结果 / Report update\n${summary}\n${conclusion[status]}${status==='violation_confirmed'?'\n'+(['item','ride'].includes(report.target_type)?'内容已下架 / Content removed':'不适用内容下架 / Content takedown not applicable'):''}\n审核备注 / Review note: ${note}`}]);
 // The BM flow additionally notifies the publisher when an item/ride is taken down.
 if(status==='violation_confirmed'&&owner)await pool.query('INSERT INTO notification_jobs(id,payload) VALUES($1,$2)',[randomUUID(),{userId:owner,reportId:id,kind:'target_owner_violation_notice',text:`内容下架通知 / Content removed\n${summary}\n${conclusion[status]}${status==='violation_confirmed'?'\n'+(['item','ride'].includes(report.target_type)?'内容已下架 / Content removed':'不适用内容下架 / Content takedown not applicable'):''}\n审核备注 / Review note: ${note}`}]);
}
