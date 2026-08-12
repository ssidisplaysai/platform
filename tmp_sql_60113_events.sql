select "eventId","jobId","eventType",stage,status,message,source,"occurredAt",sequence,metadata
from "GopJobEvent"
where metadata::text like '%60113%' or message like '%60113%'
order by "occurredAt" asc
limit 50;