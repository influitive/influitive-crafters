---
published: false
---

I want to start this blog post, the same way I start all my posts, explaining that I really do love Ruby On Rails. My blog posts are critical of Rails because I love it and want it to improve so I don't have to one day switch to Django or (yikes) some PHP framework. 

When I was interviewing for my current job, I was asked what things I would change about Rails and Ruby and that inspired me to think about it more and more. So I thought I'd start a new series of blog posts on a few of my least favourite Rails features; things I would love to see gone from Rails 5. 

These things that just have "code smell" to me in and although I'm not sure I will have a better solution, it might be fun to explore.

One thing that constantly bothers me in our code base at Influitive is model persistence callbacks, especially conditional callbacks. I wrote about this and validation callbacks once [before](http://infinitemonkeys.influitive.com/1/post/2013/01/managing-rails-complexity-part-i.html). 

Here is an example from just one of our models. 

##### challenge.rb

```ruby
## lots more code before
 
after_create :set_reference_defaults, if: "reference_request?"
before_validation :check_prospect
before_save       :update_activities # This should come before update_flags to make sure confirmation_required is cleared for deleted stages
before_save       :update_flags, :set_simple
before_destroy    :check_deletable?
before_save       :update_listeners
before_create     { build_statistic unless statistic }
 
## lots of code after.
```

## Why is this so bad? 

Well for one thing, the ordering is confusing. The after_create comes first yet happens last, so the ordering in the code doesn't matter. Or does it? There are three before_save(s) so what order do they happen in? The two on line 6, which one happens first? Are you sure?

What about observers? When do they happen in relation to these callbacks? What about an after_save vs after_create, do you know which happens first? Will the next programmer who looks at this code?

Also, the logic for whether something is called should be contained within the object that is doing that action. For example, if a reference request should only get defaults set if it's a reference_request?, then that method should decide that. If we only want to build a statistic on first creation and only if it doesn't already exist, then put that logic in one place, where it belongs, in the build_statistic method. I don't want to have to check two places to find the logic involved. 

However, the biggest problem with this code, is what is required from Rails in order to do this kind of magic. (see side note). 

#### SIDE NOTE:

```
The code in Rails to implement callbacks is pretty ridiculous. Some crazy compromises had to made to make this "magic" work. 

We don't often think about the time needed to maintain this type of code, but it is a huge cost that make any changes very difficult especially for people new to the language or framework. 

If we could remove this code and use standard Ruby processes, we would have much less code to maintain, bugs to track down, and a lot less stress in general.
 
Checkout ActiveSupport::Callbacks for some fun reading. If you understand this code, write a blog post and explain it to me. :)
```

## So what can we do about it?

I'm not sure really, but one thing we could do is create a service class that builds a valid challenge model based on the the params given. It doesn't really seem like the job of the challenge model to update activities or flags. Its job should be to persist itself to the database. That's it. 

Ignoring that for now, a simple thing we could do is use inheritance. Since we are inheriting from ActiveRecord::Base, why not overwrite the "save" method (technically create_or_update is better to use) to run our actions first? It's simple, it's standard Ruby and everyone understands it. There is no magic, no disadvantages as far as I can see, and reduces framework code.

```ruby
## lots more code before
 
def create_or_update
  update_activities
  update_flags
  set_simple
  build_statistic # check for existing statistic and if new_record? in the build method
  super # this saves!
  set_reference_defaults # should check for existing defaults
end
``` 
#### As a side note: if the save method is doing this much work, there should probably be a service class builder. imho

Thanks... Opinions?
