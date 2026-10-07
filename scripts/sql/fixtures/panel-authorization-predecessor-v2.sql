-- Test-only predecessor receipt loaded after the exact pinned migration replay.
create schema gate3_fixture;
create table gate3_fixture.static_receipts(receipt_key text primary key,receipt_value text not null);
insert into gate3_fixture.static_receipts values
 ('repository_commit','526f614be9cc1efc9269bc62996eaa85b3504be2'),
 ('migration_tree','67:2903b6394145b3c902452527ea7842f29b7af31ef0038693dccde5df2a0f8b54'),
 ('state','gate3-predecessor-v2');
