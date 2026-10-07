-- gate3-canonicalizer-v2: recursively closed, OID/order-free UTF-8 semantic identities.
\pset tuples_only on
\pset format unaligned
with recursive
ns as(select oid,nspname from pg_namespace where nspname in('auth','public','storage','supabase_migrations','gate3_fixture')),
candidate as(select c.tableoid classid,c.oid,format('%I.%I',n.nspname,c.relname) key from pg_class c join ns n on n.oid=c.relnamespace union all select p.tableoid,p.oid,format('%I.%I(%s)',n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)) from pg_proc p join ns n on n.oid=p.pronamespace),
raw_edge as(select d.classid,d.objid,d.refclassid,d.refobjid from pg_depend d join candidate a on(a.classid,a.oid)=(d.classid,d.objid) join candidate b on(b.classid,b.oid)=(d.refclassid,d.refobjid) union select c.tableoid,c.oid,p.tableoid,p.oid from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_proc p on p.oid=t.tgfoid where not t.tgisinternal union select c.tableoid,c.oid,r.tableoid,r.oid from pg_constraint x join pg_class c on c.oid=x.conrelid join pg_class r on r.oid=x.confrelid where x.contype='f'),
edge as(select * from raw_edge union select refclassid,refobjid,classid,objid from raw_edge),
closure(classid,oid) as(select classid,oid from candidate where key in('auth.users','public.empresa','public.usuario','public.membresia','public.producto','public.categoria','public.producto_categoria','public.producto_variante','public.imagen_producto','public.producto_stock_resumen','public.historial_stock','public.empresa_dominio','storage.objects','storage.buckets') union select e.refclassid,e.refobjid from closure c join edge e on(e.classid,e.objid)=(c.classid,c.oid)),
rels as(select c.* from pg_class c join closure x on(x.classid,x.oid)=(c.tableoid,c.oid)),procs as(select p.* from pg_proc p where exists(select from closure x where(x.classid,x.oid)=(p.tableoid,p.oid)) or has_function_privilege('anon',p.oid,'execute') or has_function_privilege('authenticated',p.oid,'execute')),
routine_keys as(select p.oid,format('%I.%I(%s)',n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)) k from pg_proc p join pg_namespace n on n.oid=p.pronamespace),
type_keys as(select t.oid,format('%I.%I',n.nspname,t.typname) k from pg_type t join pg_namespace n on n.oid=t.typnamespace),
operator_keys as(select o.oid,format('%I.%I(%s,%s)',n.nspname,o.oprname,coalesce(l.k,'∅'),coalesce(r.k,'∅')) k from pg_operator o join pg_namespace n on n.oid=o.oprnamespace left join type_keys l on l.oid=o.oprleft left join type_keys r on r.oid=o.oprright),
aggregate_definitions as(
 select a.aggfnoid,concat_ws(',',
  'aggkind='||a.aggkind::text,
  'aggnumdirectargs='||a.aggnumdirectargs::text,
  'aggtransfn='||coalesce(trans.k,'∅'),
  'aggfinalfn='||coalesce(final.k,'∅'),
  'aggcombinefn='||coalesce(combine.k,'∅'),
  'aggserialfn='||coalesce(serial.k,'∅'),
  'aggdeserialfn='||coalesce(deserial.k,'∅'),
  'aggmtransfn='||coalesce(mtrans.k,'∅'),
  'aggminvtransfn='||coalesce(minvtrans.k,'∅'),
  'aggmfinalfn='||coalesce(mfinal.k,'∅'),
  'aggfinalextra='||a.aggfinalextra::text,
  'aggmfinalextra='||a.aggmfinalextra::text,
  'aggfinalmodify='||a.aggfinalmodify::text,
  'aggmfinalmodify='||a.aggmfinalmodify::text,
  'aggsortop='||coalesce(sortop.k,'∅'),
  'aggtranstype='||coalesce(transtype.k,'∅'),
  'aggtransspace='||a.aggtransspace::text,
  'aggmtranstype='||coalesce(mtranstype.k,'∅'),
  'aggmtransspace='||a.aggmtransspace::text,
  'agginitval='||coalesce(a.agginitval,'∅'),
  'aggminitval='||coalesce(a.aggminitval,'∅')) definition
 from pg_aggregate a
 left join routine_keys trans on trans.oid=a.aggtransfn
 left join routine_keys final on final.oid=a.aggfinalfn
 left join routine_keys combine on combine.oid=a.aggcombinefn
 left join routine_keys serial on serial.oid=a.aggserialfn
 left join routine_keys deserial on deserial.oid=a.aggdeserialfn
 left join routine_keys mtrans on mtrans.oid=a.aggmtransfn
 left join routine_keys minvtrans on minvtrans.oid=a.aggminvtransfn
 left join routine_keys mfinal on mfinal.oid=a.aggmfinalfn
 left join operator_keys sortop on sortop.oid=a.aggsortop
 left join type_keys transtype on transtype.oid=a.aggtranstype
 left join type_keys mtranstype on mtranstype.oid=a.aggmtranstype),
relation_rows as(select 'relation' kind,format('%I.%I',n.nspname,c.relname) k,concat_ws('|',c.relkind,c.relpersistence,pg_get_userbyid(c.relowner)) v from rels c join pg_namespace n on n.oid=c.relnamespace),
column_rows as(select 'column' kind,format('%I.%I.%I',n.nspname,c.relname,a.attname) k,concat_ws('|',a.attnum,format_type(a.atttypid,a.atttypmod),a.attnotnull,a.attidentity,a.attgenerated,coalesce(coll.collname,'∅'),coalesce(pg_get_expr(d.adbin,d.adrelid),'∅')) v from pg_attribute a join rels c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace left join pg_attrdef d on(d.adrelid,d.adnum)=(a.attrelid,a.attnum) left join pg_collation coll on coll.oid=a.attcollation where a.attnum>0 and not a.attisdropped),
index_rows as(select 'index' kind,format('%I.%I',n.nspname,c.relname) k,concat_ws('|',pg_get_indexdef(i.indexrelid),i.indisunique,i.indisvalid,i.indisready,coalesce(pg_get_expr(i.indpred,i.indrelid),'∅')) v from pg_index i join rels c on c.oid=i.indexrelid join pg_namespace n on n.oid=c.relnamespace),
constraint_rows as(select 'constraint' kind,format('%I.%I.%I',n.nspname,c.relname,x.conname) k,concat_ws('|',pg_get_constraintdef(x.oid,true),x.convalidated,x.condeferrable,x.condeferred,x.confupdtype,x.confdeltype,x.confmatchtype) v from pg_constraint x join rels c on c.oid=x.conrelid join pg_namespace n on n.oid=c.relnamespace),
rls_rows as(select 'rls' kind,format('%I.%I',n.nspname,c.relname) k,concat_ws('|',c.relrowsecurity,c.relforcerowsecurity) v from rels c join pg_namespace n on n.oid=c.relnamespace where c.relkind in('r','p')),
policy_rows as(select 'policy' kind,format('%I.%I.%I',n.nspname,c.relname,p.polname) k,concat_ws('|',p.polpermissive,p.polcmd,(select string_agg(r.rolname,',' order by r.rolname) from unnest(p.polroles) q(x) join pg_roles r on r.oid=q.x),coalesce(pg_get_expr(p.polqual,p.polrelid),'∅'),coalesce(pg_get_expr(p.polwithcheck,p.polrelid),'∅')) v from pg_policy p join rels c on c.oid=p.polrelid join pg_namespace n on n.oid=c.relnamespace),
acl_rows as(select 'relation_acl' kind,format('%I.%I',n.nspname,c.relname) k,concat_ws('|',pg_get_userbyid(c.relowner),coalesce((select string_agg(concat_ws(':',coalesce(g.rolname,'PUBLIC'),o.rolname,e.privilege_type,e.is_grantable),',' order by coalesce(g.rolname,'PUBLIC'),e.privilege_type,e.is_grantable) from aclexplode(coalesce(c.relacl,acldefault(case when c.relkind='S' then 'S'::"char" else 'r'::"char" end,c.relowner))) e left join pg_roles g on g.oid=e.grantee join pg_roles o on o.oid=e.grantor),'∅'),coalesce((select string_agg(a.attname||':'||e.privilege_type||':'||coalesce(g.rolname,'PUBLIC'),',' order by a.attname,e.privilege_type,coalesce(g.rolname,'PUBLIC')) from pg_attribute a cross join lateral aclexplode(a.attacl)e left join pg_roles g on g.oid=e.grantee where a.attrelid=c.oid and a.attacl is not null),'∅')) v from rels c join pg_namespace n on n.oid=c.relnamespace),
default_acl_rows as(select 'default_acl' kind,format('%s:%s:%s',coalesce(n.nspname,'GLOBAL'),d.defaclobjtype,pg_get_userbyid(d.defaclrole)) k,string_agg(concat_ws(':',coalesce(g.rolname,'PUBLIC'),o.rolname,e.privilege_type,e.is_grantable),',' order by coalesce(g.rolname,'PUBLIC'),e.privilege_type,e.is_grantable) v from pg_default_acl d left join pg_namespace n on n.oid=d.defaclnamespace cross join lateral aclexplode(d.defaclacl)e left join pg_roles g on g.oid=e.grantee join pg_roles o on o.oid=e.grantor where n.oid is null or n.nspname in(select nspname from ns) group by n.nspname,d.defaclobjtype,d.defaclrole),
routine_rows as(select 'routine' kind,format('%I.%I(%s)',n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)) k,concat_ws('|',pg_get_function_result(p.oid),p.prokind,l.lanname,p.provolatile,p.proisstrict,p.proleakproof,p.proparallel,p.prosecdef,coalesce(array_to_string((select array_agg(x order by x) from unnest(p.proconfig)x),','),'∅'),pg_get_userbyid(p.proowner),case p.prokind when 'f' then pg_get_functiondef(p.oid) when 'p' then pg_get_functiondef(p.oid) when 'w' then pg_get_functiondef(p.oid) when 'a' then coalesce(a.definition,'aggregate_catalog=missing') else 'unsupported_prokind='||p.prokind::text end) v from procs p join pg_namespace n on n.oid=p.pronamespace join pg_language l on l.oid=p.prolang left join aggregate_definitions a on a.aggfnoid=p.oid),
routine_acl_rows as(select 'routine_acl' kind,format('%I.%I(%s)',n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)) k,concat_ws('|',coalesce((select string_agg(concat_ws(':',coalesce(g.rolname,'PUBLIC'),o.rolname,e.privilege_type,e.is_grantable),',' order by coalesce(g.rolname,'PUBLIC'),e.privilege_type,e.is_grantable) from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner)))e left join pg_roles g on g.oid=e.grantee join pg_roles o on o.oid=e.grantor),'∅'),has_function_privilege('anon',p.oid,'execute'),has_function_privilege('authenticated',p.oid,'execute')) v from procs p join pg_namespace n on n.oid=p.pronamespace),
trigger_rows as(select 'trigger' kind,format('%I.%I.%I',n.nspname,c.relname,t.tgname) k,concat_ws('|',t.tgenabled,pg_get_triggerdef(t.oid,true),format('%I.%I(%s)',pn.nspname,p.proname,pg_get_function_identity_arguments(p.oid)),pg_get_userbyid(p.proowner),t.tgconstraint) v from pg_trigger t join rels c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace join pg_proc p on p.oid=t.tgfoid join pg_namespace pn on pn.oid=p.pronamespace where not t.tgisinternal),
view_rows as(select 'view' kind,format('%I.%I',n.nspname,c.relname) k,concat_ws('|',pg_get_viewdef(c.oid,true),pg_get_userbyid(c.relowner),coalesce(array_to_string((select array_agg(x order by x) from unnest(c.reloptions)x),','),'∅')) v from rels c join pg_namespace n on n.oid=c.relnamespace where c.relkind in('v','m')),
dependency_rows as(select 'dependency' kind,a.key||'->'||b.key k,e.deptype::text v from pg_depend e join candidate a on(a.classid,a.oid)=(e.classid,e.objid) join candidate b on(b.classid,b.oid)=(e.refclassid,e.refobjid) where exists(select from closure c where(c.classid,c.oid)=(a.classid,a.oid)) and exists(select from closure c where(c.classid,c.oid)=(b.classid,b.oid))),
bucket_rows as(select 'bucket' kind,'storage.buckets.'||b.id k,concat_ws('|',b.public,b.file_size_limit,coalesce(array_to_string((select array_agg(x order by x) from unnest(b.allowed_mime_types)x),','),'∅'),(select count(*)||':'||encode(extensions.digest(convert_to(coalesce(string_agg(encode(extensions.digest(convert_to(o.name||coalesce(o.metadata::text,''),'UTF8'),'sha256'),'hex'),''),''),'UTF8'),'sha256'),'hex') from storage.objects o where o.bucket_id=b.id)) v from storage.buckets b where b.id='producto-imagenes'),
migration_rows as(select 'migration' kind,'supabase_migrations.'||version k,concat_ws('|',name,encode(extensions.digest(convert_to(coalesce(statements::text,'∅'),'UTF8'),'sha256'),'hex')) v from supabase_migrations.schema_migrations),receipt_rows as(select 'static_receipt' kind,'gate3_fixture.'||receipt_key k,receipt_value v from gate3_fixture.static_receipts),
all_rows as(select * from relation_rows union all select * from column_rows union all select * from index_rows union all select * from constraint_rows union all select * from rls_rows union all select * from policy_rows union all select * from acl_rows union all select * from default_acl_rows union all select * from routine_rows union all select * from routine_acl_rows union all select * from trigger_rows union all select * from view_rows union all select * from dependency_rows union all select * from bucket_rows union all select * from migration_rows union all select * from receipt_rows)
select jsonb_build_object('kind',kind,'object_key',k,'canonical_sha256',encode(extensions.digest(convert_to(k||'|'||v,'UTF8'),'sha256'),'hex'))::text from all_rows order by kind,k,v;
