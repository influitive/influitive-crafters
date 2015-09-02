---
published: false
---

## Rails, the toddler

Ruby on Rails has been an amazing revolution in developing web applications. It has transformed the way we work and has introduced many of us to new concepts like testing and REST and has truly advanced the industry. I love Rails and will fight any new technology that challenges it unless it is mind-blowing like Rails was when I first heard about it in the now famous “write a blog in 15 minutes” screencast. (I am keeping an eye on Meteor and believe that front-end frameworks are the future, but that is another story).
A major source of criticism against Rails in the beginning, however, was “It can’t scale”. Many of us thought this was a non-issue but in hindsight, it IS a issue. But not in the way critics intended but rather in terms of writing large, truly large, applications. The problem many of us are now facing is whether Rails can scale, not in production performance, but in domain logic complexity.

One of the conventions that @dhh brought to the web world (others had done that, but for many of us, he popularized it), was the idea of MVC. A lot of people believed that this was overkill for a web applications because most web applications at the time were much smaller and less complex. Using a clear structure, which while requiring more boilerplate code, has allowed web applications to grow in a way that would be very difficult otherwise. For that alone we have to be thankful to @dhh and Rails. And his use of predefined folder structure and generators made the boilerplate problem almost non-existent.

## Rails, the adolescent

And grow they did. It is this growth in application complexity that I believe is causing Rails to reach a boiling point in a similar way that single file PHP coding caused the tension that created Rails. Many people, including us at Influitive, are working on projects that are pushing the limits of Rails. If you disagree with this statement, then there is a good chance that your application complexity simply hasn’t reached this point. Unfortunately, some people refuse to admit that there is a problem: “Rails can solve every problem”; “If you are having problems it’s because you’re using Rails incorrectly”; “Rails is designed for very specific type of problem and it works for 80% of the people”.

This brings up several common problems working on extremely large Rails apps that follow the typical Rails “way”. Recently working on our app with a new developer (we pair program 100% of the time at Influitive), I was afraid to save a model because I wasn’t sure which callbacks and observers would run. In tracing down the callbacks into models and concerns, there were several things happening that had nothing to do with the problem we were working on.

N.B. The code samples are not a meant as examples of good code (obviously) but rather what can happen if you walk the rails ‘way’ to its conclusion.

contact.rb
```ruby
before_validation :download_remote_image, :if => :image_url_provided?
before_validation :set_default_name
 
after_destroy :clean_challenge_flags
after_create :set_default_level
before_save  :update_invitation_flags
before_save(:if => :update_user)  { User.update(user_id, email: email) }
 
validates :name, :presence => true
validates :email, format: /^(.+@.+\..+|)$/, uniqueness: { :case_sensitive => false }, presence: true
validates :type, presence: true, inclusion: {:in => ['Prospect', 'Advocate', 'Corporate']}
 
validates_presence_of :image_remote_url, if: :image_url_provided?,
  message: 'is invalid or inaccessible'
 
validate :salesforce_id_length #salesforce allow two different lengths. thanks salesforce!
def salesforce_id_length
  ... you get the idea ...
```

This doesn’t include all the observers that might be running.

Another common issue that we also faced with this model was “validation soup” for lack of a better term (which you can also see above). There were many validations that had conditional “if:”s and “unless:”s because the same model was being used for many different purposes. This is not only ugly, it is difficult to reason about, and error prone. Some of these were in the models, others from related Concerns. (sigh)

```ruby
validates_presence_of :stage unless: closed?
validates_with Validators::Stages::ActivityValidator, if: advancing
validates :prospect, presence: true, unless: :template?,
  if: ->{|c| c.challenge_type_code == 'reference'}
 
validate  :corporate_confirmation_stage_cannot_be_first
def corporate_confirmation_stage_cannot_be_first
  first_stage = stages.reject(&:marked_for_destruction?).sort_by(&:position).first
  errors.add(:stages, "'Corporate Workflow' cannot be the first stage of a challenge.") if
    first_stage && first_stage.stage_type.to_sym == :corporate_confirmation
end
```

Yet another thing that happens quite often is running into a situation where the validations you’ve set up on a model don’t apply to THIS particular use case. So what’s a Rails programmer to do? Simple.

```ruby
contact.update_attributes! mapping, as: :admin
```

Now you can avoid validations but just in this case. I believe the problem is that some validations and some callbacks apply only in some situations but not others. This was simple when the domain logic was in the controller but since we’ve all agreed to move it into the models, we now need to have a lot of conditionals and unneccessary checks. (yes, strong parameters might help in some cases)

## Rails, the young adult

Many people advocate the use of service objects in the controller to improve testing times and isolate the domain layer from the persistence layer, including the brilliant Gary Bernhardt in his very affordable screencasts. This is a tried and true methodology that has worked for decades but Rails (and the Rails creator) push back hard against the idea as unnecessary ceremony. I can see his point in many cases, and the service object idea does sometimes feel heavy handed in simple cases. At the beginning when a simple “if” on a validation, or a simple callback, or an observer, or just a little logic in the controller can solve the immediate problem, it is difficult to justify a completely new paradigm. Of course, over time your model becomes very large. The Rails solution is to move things into a different file with Concerns, but you quickly realize that all you’ve really done is create multiple places to look for those callbacks and validations. Unfortunately, these “quick win” solutions are a slippery slope to a code complexity pit that is hard to climb out of.

Web applications are getting more and more complex and breaking up your app into smaller services only works to a point and has its own issues. Internet speeds are getting faster, browsers are becoming more capable and if Rails is going to be useful in the future we need to allow for Rails applications that can grow vastly in complexity. We, as a community, need to find a solution to this problem if we want Ruby On Rails to be significant in the next 5-7 years.

## Rails, the adult

Unfortunately, I think this means we need to change as a community to open our minds to other opinions and listen to the other “camp”. I follow a lot of conversations on twitter and I am often embarrassed at the level of “discussion” that takes place. We have two camps of thought that don’t listen to each other. I think a “fork” in the road is coming unless this changes. The people that think that ActiveRecord::Concerns solves all of our complexity problems need to listen (and not mock) the people that think the solution is traditional Object Oriented Programming (or a more DCI-ish approach). And the OOP people need to listen to (and not mock) the people that are worried that the beauty of programming in Ruby simply becomes Java ceremony when there are simpler solutions available.

I’ve heard a saying in the Ruby community that “Matz is nice, so we are nice”, so let’s follow that notion to come up with a solution to the biggest problem facing Rails (and many of us programmers) today.

In another post, I may be brave enough to propose one idea to manage some of this complexity.

Feel free to leave comments (not personal attacks) below.
