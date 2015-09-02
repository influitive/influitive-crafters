---
layout: post
title:  "Don't Use a Shared Connection on Full Stack Capybara Tests"
author: "Brad Robertson"
date:   2015-09-02 15:38:50
categories:
  - news
---

A while back, Jose Valim [posted a Gist](https://gist.github.com/josevalim/470808) on using a shared db connection for Capybara acceptance tests. Since Capybara loads your app up in a separate thread (which would use a different db connection) the theory here is that by having the test suite AND your app use the *same* connection, you can run your acceptance tests in a transaction for super fast cleanup.

Indeed at first glance, it seemed to work well, we could use `DatabaseCleaner` (or `transactional_fixtures`) to keep our tests clean and fast and life was good.

Then we started seeing the odd failure. It wasn't consistent, (which should have been an immediate red flag) so we kind of just ignored them and retried on the CI server.

After reading through the comment thread on that gist, we saw Mike Perham mention a race condition, which would *maybe* explain our random failures. So we modified our shared connection monkeypatch to look like this:

```ruby
# Don't do this!!
class ActiveRecord::Base
  mattr_accessor :shared_connection
  @@shared_connection = nil

  def self.connection
    @@shared_connection || ConnectionPool::Wrapper.new(:size => 1) { retrieve_connection }
  end
end
```

Again things *seemed* fine, but of course the nature of random failures is that it's hard to know if you've ever actually fixed the thing.

Well this didn't. Still, we'd get, I'd say around 10% of our builds randomly failing. We'd have a test that looks roughly like this:

```ruby
it "lets a user join from an invite token" do
  invitation = create(:invitation)
  visit join_path(invitation.token)
  page.should have_content("You can Sign up!")
end
```

You'll notice we're creating a record in the db, which is in the test runner thread. Then we're accessing a property of that record in the app thread that Capybara spins up.

Many, many times, the test would fail, because the app couldn't find the invitation. It seemed as if it was *somehow* created in a *different* transaction, so it just never existed as far as the app was concerned.

The conclusion from this is that there's a major issue with this shared connection approach. It clearly still doesn't operate the way you want consistently, and consistency/accuracy is pretty much the most important quality of a test suite.

A randomly failing test is more harmful than no test at all.

Instead of deleting our randomly failing tests, we decided to fix the root cause. So we removed this shared connection. For our feature specs only, we go back to the good old truncation strategy.

This has issues of their own however. Our app relies on seeded data to operate. We expect roles and permissions to be there, also other things like seeded challenge templates. Without these, our tests would still fail.

Unfortunately truncating every table and re-seeding *everything* makes our tests **super slow**.

At this point, we've identified some problems. Our application cannot run without some seeded data, and because of that, many tests have dependencies on this data.

We decided to take the long route and explicitly call out the required seeds for each test, so we can at least start to expose these dependencies, and hopefully one day remove them.

In the end we made a little helper method that will allow a test to declare its seed dependencies. It looks like:

```ruby
# spec/support/database_seeder
module DatabaseSeeder

  def seed_with(file_names)
    before do
      file_names.each do |file_name|
        SeedOMatic.run file: "config/seeds/#{file_name}.yml"
      end
    end
  end
end
```
(We use the [SeedOMatic gem](https://rubygems.org/gems/seedomatic) gem for seeding data into our apps.)

It gets extended onto ExampleGroups like so:

```ruby
# spec/spec_helper.rb
RSpec.configure do |config|
  config.extend DatabaseSeeder, type: :feature
end
```

And gets used in tests like so:

```ruby
# spec/features/my_awesome_feature_spec.rb
describe "My Awesome Feature" do
  seed_with %w[
    some_required_seed_file
    roles
    permissions
  ]
end
```

In the end this has worked out pretty well and actually runs in the **same amount** of time as our transaction based tests, but now we're consistent.

I should note that this is a work in progress. We ultimately don't want our test suite to have any of these depencencies, but the first step is calling out all the dependencies, then working on removing them once they're exposed.

Happy testing!
