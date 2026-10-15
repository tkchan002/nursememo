-- Demo data for Night Memo.
-- Phone and fax numbers below are intentionally random four-digit demo values.
-- Run after schema.sql.

insert into public.form_versions(version,effective_from,status,schema_snapshot)
values (1,'2026-01-01','published','{}'::jsonb)
on conflict (version) do nothing;

insert into public.wards(name,phone,fax,empty_bed_gender_mode,display_order,active)
values
 ('C10','6397','3129','male',1,true),
 ('E10','9358','2921','male',2,true),
 ('G2','8072','4846','male',3,true),
 ('F10','8973','7432','male',4,true),
 ('E6','2372','9476','male',5,true),
 ('C6','5333','1137','male',6,true),
 ('G10','5834','1153','male',7,true),
 ('G11','6624','4882','mixed',8,true),
 ('B10','4662','8510','male',9,true),
 ('H6','1075','2810','mixed',10,true)
on conflict ((lower(name))) do update set
 phone=excluded.phone,
 fax=excluded.fax,
 empty_bed_gender_mode=excluded.empty_bed_gender_mode,
 display_order=excluded.display_order,
 active=true;

-- Initial operating periods.
insert into public.ward_operating_periods(ward_id,start_date,end_date,note)
select w.id,'2026-01-01',null,'Initial demo operating period'
from public.wards w
where w.name in ('C10','E10','G2','F10','E6','C6','G10','G11','B10','H6')
and not exists (select 1 from public.ward_operating_periods p where p.ward_id=w.id);

-- Initial capacity. These are demo values and can be changed later from maintenance.html.
insert into public.ward_capacity_history(ward_id,effective_from,effective_to,bed_capacity,note)
select w.id,'2026-01-01',null,
  case w.name when 'G2' then 36 when 'E6' then 36 when 'H6' then 36 else 40 end,
  'Initial demo capacity'
from public.wards w
where w.name in ('C10','E10','G2','F10','E6','C6','G10','G11','B10','H6')
and not exists (select 1 from public.ward_capacity_history c where c.ward_id=w.id);

-- Built-in report items. Storage names preserve the existing JSON shape where practical.
insert into public.report_items(key,section,label,input_type,options,sort_order,active,effective_from,builtin,config)
values
 ('admissionEC','admission','Admission E/C','dropdown','["0","1","2","3","4","5","6","7","8","9","10","11","12","13","14","15","16","17","18","19","20","21","22","23","24","25","26","27","28","29","30"]',1,true,'2026-01-01',true,'{"storage":"direct"}'),
 ('admissionCC','admission','Admission C/C','dropdown','["0","1","2","3","4","5","6","7","8","9","10","11","12","13","14","15","16","17","18","19","20","21","22","23","24","25","26","27","28","29","30"]',2,true,'2026-01-01',true,'{"storage":"direct"}'),
 ('discharge','admission','Discharge','dropdown','["0","1","2","3","4","5","6","7","8","9","10","11","12","13","14","15","16","17","18","19","20","21","22","23","24","25","26","27","28","29","30"]',3,true,'2026-01-01',true,'{"storage":"direct"}'),
 ('death','admission','Death','dropdown','["0","1","2","3","4","5","6","7","8","9","10","11","12","13","14","15","16","17","18","19","20"]',4,true,'2026-01-01',true,'{"storage":"direct"}'),
 ('transferIn','admission','T/I (Transfer In) Gen','dropdown','["0","1","2","3","4","5","6","7","8","9","10","11","12","13","14","15","16","17","18","19","20"]',5,true,'2026-01-01',true,'{"storage":"direct"}'),
 ('transferOut','admission','T/O (Transfer Out) Gen','dropdown','["0","1","2","3","4","5","6","7","8","9","10","11","12","13","14","15","16","17","18","19","20"]',6,true,'2026-01-01',true,'{"storage":"direct"}'),
 ('totalPatientM','bedcount','Total Patient','number','[]',7,true,'2026-01-01',true,'{"storage":"direct"}'),
 ('iCRE','infection','CRE','bed_chooser','[]',8,true,'2026-01-01',true,'{"storage":"infBeds"}'),
 ('iVRE','infection','VRE','bed_chooser','[]',9,true,'2026-01-01',true,'{"storage":"infBeds"}'),
 ('iCOV','infection','COVID','bed_chooser','[]',10,true,'2026-01-01',true,'{"storage":"infBeds"}'),
 ('iMDR','infection','MDRA','bed_chooser','[]',11,true,'2026-01-01',true,'{"storage":"infBeds"}'),
 ('iCD','infection','CD+ve','bed_chooser','[]',12,true,'2026-01-01',true,'{"storage":"infBeds"}'),
 ('iInf','infection','Inf +ve','bed_chooser','[]',13,true,'2026-01-01',true,'{"storage":"infBeds"}'),
 ('iCA','infection','Candida Auris Other Contact','bed_chooser','[]',14,true,'2026-01-01',true,'{"storage":"infBeds"}'),
 ('dMV','devices','MV','bed_or_count','[]',15,true,'2026-01-01',true,'{"storage":"devBeds"}'),
 ('dNIV','devices','NIV / BiPAP','bed_or_count','[]',16,true,'2026-01-01',true,'{"storage":"devBeds"}'),
 ('dHF','devices','HFNC','bed_or_count','[]',17,true,'2026-01-01',true,'{"storage":"devBeds"}'),
 ('dHD','devices','HD','bed_or_count','[]',18,true,'2026-01-01',true,'{"storage":"devBeds"}'),
 ('dCA','devices','CAPD','bed_or_count','[]',19,true,'2026-01-01',true,'{"storage":"devBeds"}')
on conflict (key) do update set
 section=excluded.section,label=excluded.label,input_type=excluded.input_type,options=excluded.options,sort_order=excluded.sort_order,active=excluded.active,builtin=excluded.builtin,config=excluded.config;

-- Demo staff. Real names should be maintained from ward.html or maintenance.html.
insert into public.ward_staff(ward_id,role,name,appointment_date,active,display_order)
select w.id,s.role,w.name || s.suffix,s.appt,true,s.ord
from public.wards w
cross join (values
 ('APN',' Demo APN','2022-03-01'::date,10),
 ('RN',' Demo RN A','2024-08-05'::date,20),
 ('RN',' Demo RN B','2025-07-28'::date,30)
) as s(role,suffix,appt,ord)
where w.name in ('C10','E10','G2','F10','E6','C6','G10','G11','B10','H6')
and not exists (select 1 from public.ward_staff ws where ws.ward_id=w.id);

-- No historical or synthetic patient reports are inserted here.
-- Maintenance -> Test Data generates explicit PM/Night records when required.
