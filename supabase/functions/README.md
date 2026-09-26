# Supabase platform functions

Supabase Edge Functions are reserved for platform-level hooks and narrowly scoped infrastructure functions.

Business-domain transactions belong in NestJS modules. Do not move clinical authorization, billing state machines or cross-domain HIMS workflows into Edge Functions.
