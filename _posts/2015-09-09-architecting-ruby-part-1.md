---
published: false
---

## Architecting a Service Oriented, Ruby based Platform [Part 1]

This is the first post in a multi-series, case-study about how Influitive has built and scaled its platform over time. It will take us from humble beginnings of a monolith to the current multi-service architecture and ideas for the future. I expect the posts to follow this structure:

1. Rails monolith with multi-tenancy and our first service extraction
2. Data replication/denormalization with micro-services for offloading background tasks
3. Plugin architecture for embedding services within the main container

### Influitive & The Advocate Hub Background

Influitive runs a multi-tenant, enterprise marketing platform that helps mobilize your customer advocates into an army of promoters to help scale your marketing efforts. Marketers issue "challenges" (or asks) to advocates that ultimately <blah>

We are a ruby shop using mainly Rails services to orchestrate all of this and are the authors of the [Apartment](https://rubygems.org/gems/apartment) rubygem which helps segregate our customer data into multiple tenants.

### In the Beginning

Like most new Rails developers/shops, we started out with an idea and furiously built out a prototype until we had some traction on what we were trying to achieve. In this phase, not much attention is paid to APIs, or architecture because you don't know exactly what you're trying to build.

The basis for our architecture was a multi-tenant system using the Apartment rubygem. Apartment works be segregating a tenant's data into a [Postgresql schema](http://www.postgresql.org/docs/9.4/static/ddl-schemas.html) (or Mysql database if you use mysql). Each tenant contains a full copy of the database structure including all relations and sequences etc. It furthermore includes certain `public` (or `excluded`) relations that are not specific to any tenant. These public tables store global information such as the list of customers (tenants) themselves as well as some other statistical data about the hub. The basic database model looks like this.

![Hub Database Structure]({{site.baseurl}}/_posts/hub_database_structure.png)

This multi-tenant strategy is not without its downsides (higher db memory footprint due to more tables, slower backups/migrations) but has allowed us to iterate quickly without having to think about security and indexing contraints that would otherwise be a major concern with classic column based scoping. 

The biggest downside however came when we realized we wanted contacts to share authentication information (username/password/oauth info) amongst different tenants for a unified login. This tenanted approach to data segregation makes it very difficult to query across tenants and really, given the logical shards, I'd argue you really shouldn't be doing that anyway. Now, the user authentication information could simply be stored in the public (excluded) schema, but we were aware that we'd want all of our future applications to be able to authenticate against this single source while not affecting the performance of our main application so this is where our first micro-service was extracted.

### NarciService - It's all about you

The aptly named `NarciService` was the narcissistic incarnation that would store all the global information about our users across all tenants. It is a Rails Api service that has no information about tenants, just individual user information in a global `users` table (plus associated tables for auth_tokens etc). Each contact row in each tenant stores a `user_id` foreign key to the `NarciService::User` object. As such you may have contacts in *different* tenants pointing to the same `user_id`, but no two contacts in the *same* tenant can point to the same User. It looks like this:

![Hub w/ NarciService]({{site.baseurl}}/_posts/hub_narci_structure.png)

### Session Management - Custom domains and subdomains

TODO