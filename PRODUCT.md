# Waste Operations Data Hub

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js App Router, TypeScript, shadcn/ui, Tailwind CSS, Express, Prisma 6, PostgreSQL. Local development; Neon-ready deployment configuration.

## Users

Municipal waste operations staff, integration operators, data stewards, and read-only analysts. Their work is checking service reliability and resolving import and data-quality issues.

## Product Purpose

Connect collection, fleet, weighbridge, recycling, work-order, contract, and citizen service data through a governed canonical model. Make source → integration → governance → output traceable.

## Capabilities and Constraints

The supplied project plan defines the MVP. The user confirmed the overview should lead with service reliability and authorized building directly in code. Avoid repeated Neon API/database requests: all development tests run locally; no automatic dashboard polling. Only synthetic data is available. Deployment municipality and production identity provider are undecided.

## Product Principles

1. Every metric has a database source and an explicit reporting period.
2. Quarantine bad records with useful reasons; retries never replay successes.
3. Enforce organization isolation and permissions on the server.
4. Make quality scoring and lineage understandable.

## Accessibility & Inclusion

Keyboard-accessible controls, visible focus, labeled inputs, status text alongside color, and mobile navigation.
