---
published: false
---

At Influitive, our RubyOnRails app is getting large, quite large, and we are struggling with staying agile as we accumulate technical debt. 

One of the arguments that we often have is where to place new code for new features. For a hypothetical example, let's write a new feature in two different ways and see what the pros and cons are for each approach.

Suppose we want to have one of our users follow another user.

### First Iteration 
#### The Rails Way

```ruby
class User
... # a serious amount of code

  def follow(another)
    # pseudocode to actually follow
    self.followed_by << another
  end
  
... a lot more code 

end
```

#### The Service Class

```ruby
struct UserFollow(to_follow, follower) do
  def run
    # pseudocode to actually follow
    to_follow.followed_by << another
  end
end
```

### Pros/ Cons

Seems amazingly simple! The architecture patterns books will give you tons of reasons why you should decouple the following code from the database persistance layer, see [CleanCode](http://blog.groupbuddies.com/posts/20-clean-architecture?utm_source=rubyweekly&utm_medium=email), or [Domain Driven Design](http://www.infoq.com/minibooks/domain-driven-design-quickly), etc. However, is this really an issue in modern software design or is it just a legacy way of thinking?

The User class can become very large using the Rails approach but most modern text editors are great at searching for methods names in large files, so is this a problem?

But what happens when the logic for a user following another becomes complicated? How can you scale it? Sure you can add more lines to the method but that can get unwieldy rather quickly.

Let's assume that the product team asks you to restrict following to people that are within a certain age group of each other.

### Iteration2: Age restriction 
#### The Rails Way

```ruby
class User
... # a serious amount of code

  def follow(another)
    # this line is confusing
  	if (self.age - another.age).abs < 10
      self.followed_by << another
    end
  end
... a lot more code 

end
```
Or
```ruby
class User
... # a serious amount of code

  def follow(another)
  	if within_age(another)
      self.followed_by << another
    end
  end
  
  # you could create a method here but 
  # now you have this random method that is only
  # used by one method floating around user.rb
  def within_age(another) 
    max_age_difference = 10 
    (self.age - another.age).abs < max_age_difference
  end
  
... a lot more code 

end
```

#### The Service Class

```ruby
struct UserFollow(to_follow, follower) do
  def run
  	# separate method documents the logic
    if within_age_limit
      to_follow.followed_by << another
    end
  end
  
  private 
  
  # these methods don't pollute the user.rb
  def max_age_difference
    10
  end
  
  def within_age_limit
    (self.age - another.age).abs < max_age_difference
  end
end
```

Now, of course, a single line rule for checking the age is not the problem in a large app. The problem is when that logic gets more and more complex which will happen as your app grows. As the logic starts to grow for what it means to follow someone, there are more and more methods that need to be added to the user.rb file. One might ask if it really makes sense to have a class for users that deals with creating a user. persisting it to the database also deal with following users. 

### Testing
Without going into too much detail, it's much easier to test the code in the service class compared to the code in the user.rb. The Rails way requires loading the entire Rails environment and lots of unrelated code. The service class can simply pass in two doubles and ensure that the right methods are called or not called depending on the ages of those doubles. 

### Conclusion

People will argue that you should start with the code in the object class and then move it out when it becomes of sufficient size. Unfortunately, the next time someone has to add one more little rule, it's a slippery slope and everything will just end up getting added to the user.rb file.

So in my opinion, unless you know that something will stay very very small, make it a Service class. Another good rule of thumb is, if it sounds like a verb it should be a service.

