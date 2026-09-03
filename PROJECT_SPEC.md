# SaaS Starter: Project Overview

This repository is a reusable foundation for closed B2B SaaS products, not a
business application. Its goal is to provide working identity, companies,
Branches, access management, email, database access and a neutral UI before a
cloned product adds its own business features.

## One specification structure

[specs/README.md](specs/README.md) is the single index and entry point for all
module specifications. Each module describes its current behavior, rules,
implementation references, limitations and acceptance checks.

This overview does not duplicate those contracts. Module numbers indicate
reading order, not separate implementation phases or pending work.

## Product at a glance

- The SaaS operator creates companies, their first Owner and a `Main` Branch.
- Owners/admins add employees; users choose their own passwords.
- Accounts can belong to several companies, with separate memberships and access.
- Owners access all Branches; admins can have all or selected Branches; members
  use assignments. Only the Owner can delegate permission to appoint admins.
- Company access can be deactivated/reactivated without deleting identity or
  history. One active company auto-enters; multiple require a choice when needed.
- Platform roles and company roles are separate; server guards enforce access.
- Public signup, billing and business-specific features are outside the starter.
- Local, remote dev and production have isolated configurations, databases and
  explicit commands; cloud resource/domain setup is a separate operation.
- Language follows personal preference, active company, then application default.
  UI/email catalogs begin with English and Spanish and can be extended with other
  languages. Language settings do not translate entered business data.

The detailed boundaries and deferred extension constraints are in
[Product and Architecture](specs/00-product-and-architecture.md). Current
membership authority, including administrator creation/promotion rules, is in
[Member Management](specs/07-member-management.md).

## Supporting documents

- [README.md](README.md): installation, bootstrap, configuration and operation.
- [CLAUDE.md](CLAUDE.md): repository conventions for coding agents.
- [Verification record](specs/VERIFICATION.md): dated checks and release limits.

Starter v1 is implemented. The committed access, language and guide changes are
integrated into `main`. Specification documents remain untracked until their own
commit is requested. No push or production deployment has been performed.
