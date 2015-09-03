---
published: true
layout: post
author: Enric Ribas
date: 2013-09-02T00:00:00.000Z
description : "In a previous blog post, I tried to describe some of the problems of using Rails with very large applications. In this post, I would like to take a look at a more concrete example, and perhaps find one possible solutions..."
categories:
  - news
---


###### by: enric ribas

In a previous blog post, I tried to describe some of the problems of using Rails with very large applications. In this post, I would like to take a look at a more concrete example, and perhaps find one possible solutions. Of course, it’s extremely difficult to find a problem that is complex enough to express this problem yet small enough to write a blog post about, so you might have to use your imagination. Try to envision a bigger problem than the one I’m presenting, and forecast what would happen with each approach as we add more and more use cases. The goal here is to write things in a way that would avoid the callback and validation hell that we have in our previous blog post.
The idea I came up with is a music website that tracks bands and assigns tags to each band. The design calls for a form with a band name and a list of tags. If the band already exists, we just add the tags but don’t create a new band obviously. If the tags exist, don’t create new ones, but create a new “connection” (ie tagging) from the tag to the band. If the tagging already exists, also don’t create a new tagging. Seems simple enough, right? It might not stay simple when we start adding songs, band members, albums, etc., however.

The idea that a resource has a one-to-one relationship with a model is so ingrained in Rails, that when I first started in RoR, I wasn’t even aware you could do it any other way. I’m sure many people today still are in the same boat. Unfortunately, this is where Rails starts to have problems, in my humble opinion, and we will try and explore that in code.

> **Disclaimer**: I don’t know what the best approach is going to be. I would love it if people were to submit alternative solutions and/or comment on why one approach is better than another. I’m also sure I’ve missed a few advantages and drawbacks for each approach, so let me know.

This blog post is an attempt for myself to explore different ideas to solve some of these problems which we encounter in our daily work. Again, I don’t know the right approach either. However, I would like to find an approach that we can use all the time. If it requires extra files, like the last two approaches do, we could even create a generator for rails that creates these files for us and writes most of the boilerplate code, like Rails does for us.

## the Rails approach

NB: This is my version of the Rails Way. There might (and probably is) a better Rails Approach

In Rails, you would have Tag, Tagging, and Band models. For the form to work you could have a nested_attributes_for :taggings in the Band model. Unfortunately, this makes it difficult to not create a new tag each time or not create a new tagging each time. So I feel the best approach is to manually define a def tag_list=(params) method on band.rb.

(yes, we like to outdent the word private, like a rescue block because we feel it’s easier to scan for the private section. Let’s not make a big deal about it. :) )

```ruby
# app/models/band.rb

class Band < ActiveRecord::Base

  attr_accessible :name, :tag_list
  attr_reader :tag_list

  has_many :taggings
  has_many :tags, through: :taggings

  validates_presence_of :name

  def tag_list=(form_tags)
    extract_tags(form_tags).each do |tag_name|
      tag     = Tag.find_or_create_by_name name: tag_name
      tagging = Tagging.find_or_initialize_by_tag_id_and_band_id tag.id, self.id
      self.taggings << tagging
    end
  end

private

  def extract_tags(string)
    string.split(/ |,/).reject(&:blank?)
  end

end
```

```ruby
# app/models/tag.rb

class Tag < ActiveRecord::Base

  attr_accessible :name

  has_many :taggings
  has_many :bands, through: :taggings

end
```

```ruby
# app/models/tagging.rb

class Tagging < ActiveRecord::Base

  belongs_to :tag
  belongs_to :band

end
```

In the controller, you will need change the code from the standard scaffold to replace

_Band.new(params[:band])_

with something like

_Band.find\_or\_initialize\_by\_name_

that checks whether a band already exists. Otherwise the controller is unchanged.

```ruby
# app/controllers/band_controller.rb

def create
  @band = Band.find_or_initialize_by_name params[:band][:name]

  respond_to do |format|
    if @band.save
      format.html { redirect_to @band, notice: 'Band was successfully created.' }
      format.json { render json: @band, status: :created, location: @band }
    else
      format.html { render action: "new" }
      format.json { render json: @band.errors, status: :unprocessable_entity }
    end
  end
end
```

### the good

- standard, understood by most rails developers
- no extra files to deal with
- won’t cause giant internet battles

### the bad

- testing requires the entire rails stack and is slow
- you have code in the band model that has little to do with the band but more to do with tags. For example, the extract_tags method should not be in the band.rb and tag_list method doesn’t belong there either
- you may end up putting code like validations or callbacks in the models that works for this case but could f’up other use cases.

### the ugly (i.e. verdict)

- Yes, you could move the tag\_list, extract_tags and validations into a module and mix it in but the problem is with validations and callbacks that start to interfere with each other after a while and being in a separate file mixed in does not help, and I find this to be a big problem.

## the Service Object Approach

What if we created a service object that deals with the ugliness of creating all the models needed to create a band with tags? So basically our BandController#create would have a BandCreator object that it calls to do the heavy lifting. (don’t quote me on the service object name, I don’t really care what it’s called) In fact, BandCreate or BandCreator is probably bad because you would probably need to use this object for editing as well as creating. Another possible, maybe better, name is BandSubmission.

The controller becomes very dumb and just handles passing the parameters from the form to the object and then redirecting, rendering, and outputting the flash message. Ok, maybe the controller is still not that dumb. :)

Our models are very simple. The way they should be and just deal with database persistence. (ok, and maybe a bit more)

```ruby
# app/models/band.rb

class Band < ActiveRecord::Base

  attr_accessible :name, :tag_list

  has_many :taggings
  has_many :tags, through: :taggings

end
```

```ruby
# app/models/tag.rb

class Tag < ActiveRecord::Base

  attr_accessible :name

  has_many :taggings
  has_many :bands, through: :taggings

end
```

```ruby
# app/models/tagging.rb

class Tagging < ActiveRecord::Base

  belongs_to :tag
  belongs_to :band

end
```

In the controller, you initialize a new service object passing in all the params from the form. As a sidenote: I created a method called validate which acts like ActiveModel valid? because I don’t believe a method with a question mark should recheck validations. Note you redirect\_to using the band\_path because otherwise you have to redefine a bunch of methods to just to get Rails to understand redirecting a non-ActiveModel class, and I don’t think the magic is worth it in this case.

```ruby
# app/controllers/band_controller.rb

def create
  @band = BandCreator.new params[:band]

  if @band.validate
    @band.save

    redirect_to band_path(@band.id), notice: 'Band was successfully created.'
  else
    render action: "new"
  end
end
```

The bulk of the effort is contained in the service object where you want it. The validate method manually checks for valid form params which will quickly get annoying. An errors hash is also used to check track of errors, which again will not be fun in a short period. This is basically the same code as before but separated from the rest of the band model.

```ruby
# app/services/band_creator.rb

class BandCreator

  attr_accessor :band, :tag_list, :errors
  delegate :id, to: :band

  def initialize(params)
    @band     = Band.find_or_initialize_by_name params[:name]
    @tag_list = extract_tags params[:tag_list]
    @errors   = {}
  end

  def validate
    if band.name.empty?
     errors[:name] = 'A band requires a name.'
    end

    errors.blank?
  end

  def save
    # TODO yes, in a transaction would be better
    tag_list.each do |tag_name|
      tag = Tag.find_or_create_by_name tag_name
      tagging = Tagging.find_or_initialize_by_tag_id_and_band_id tag.id, band.id
      band.taggings << tagging
    end
    band.save
  end

private

  def extract_tags(string)
    return unless string

    string.split(/ |,/).reject(&:blank?)
  end

end
```

### the good

- testing is faster because we can stub the AR/AM methods and just load the service class
- the domain logic for creating a band is contained in one place not mixed in with logic for other use cases and easy is to find.
- validations are contained to this use case and avoids polluting the main Band class
hopefully callbacks can also be contained in this class to avoid polluting the main Band class.

### the bad

- you have to write a new class? (we could use a generator for these)
- you have to validate the data coming in manually from the form
- displaying errors on the form is very difficult unless you return a object that responds to errors.
redirect\_to requires redefining id and using band_path.

### the ugly (i.e. verdict)

- While it’s nice that it separates the logic of creating a band which deals with three different tables in your database from the band model which only deals with one table, validations and error handling are not scalable, and quite frankly just a PITA.

## the Use Case Model (ViewModel) Approach

An approach that I believe has the advantages of proper validations while still separating the logic of creation into a separate object is the “ViewModel” approach. I would prefer, however, to use a different name to avoid any inevitable feeding of the trolls (i.e. technically this isn’t a ViewModel blah, blah). My idea is a UseCase model because I would make one for each use case or story.

Our models are basically the same, and wonderfully simple.

```ruby
# app/models/band.rb

class Band < ActiveRecord::Base

  attr_accessible :name, :tag_list

  has_many :taggings
  has_many :tags, through: :taggings

end
```

```ruby
# app/models/tag.rb

class Tag < ActiveRecord::Base

  attr_accessible :name

  has_many :taggings
  has_many :bands, through: :taggings

end
```

```ruby
# app/models/tagging.rb

class Tagging < ActiveRecord::Base

  belongs_to :tag
  belongs_to :band

end
```

So each controller is connected to a UseCaseModel, which is actually an ActiveModel, and again the controller can be very simple. In this case, it can literally be a default inherited_resources controller. So simple, love it! This model provides all the fields needed for the form without nesting to the view layer. All validations are on this object (if you really want to place additional validations on the ActiveRecord models, you can but I imagine in most cases you wouldn’t). Rails can easily take care of displaying errors to the form. If you have multiple tables to save to, you would override the save method to call the appropriate save(s) on your models.

```ruby
class CreateABandController << InheritedResources::Base

  def create
    create! { band_path }
  end

end
```

The heavy lifting this time is in the use case object.

```ruby
# app/use_cases/create_a_band.rb

class CreateABand
# This would be moved into gem or lib, or ughh... superclass---
  include ActiveModel::Validations
  include ActiveModel::Conversion
  extend ActiveModel::Naming

  def initialize(attributes = {})
    attributes.each do |name, value|
      send("#{name}=", value)
    end
  end

  def persisted?
    false
  end
#------------------------------------

# Allowed Form Fields
  attr_accessor :name, :tag_list

# Validations
  validates_presence_of :name

# Attribute Formatters
  def tags
    tag_list.split(/ |,/).reject(&:blank?)
  end

# Persisting
  def save
    # Yes, again in transaction
    if valid?
      band = Band.find_or_create_by_name name

      tags.each do |tag_name|
        tag     = Tag.find_or_create_by_name tag_name
        tagging = Tagging.find_or_initialize_by_tag_id_and_band_id tag.id, band.id
        band.taggings << tagging
      end

      band.save!

      true
    end
  end

end
```

### the good

- The easiest (at least for me)
- Security, you don’t define fields that don’t want getting set for this use case only.
testing is faster than Rails Approach because you don’t need to load all of Rails, but you still need to load ActiveModel class(es)
- Validations and callbacks are defined for this use case and do not apply to other times you save to a band or tag model. For example, there might be times when you might want to save a band without a name but here you must have a name.

### the bad

- you need to define each field you plan to accept (same as attr_accessible so not really a disadvantage)
- you might have to define the same validations in different use cases
- it’s different and no one likes different.

### the ugly (ie verdict)

- I don’t know about everyone else, but I like it. The domain logic for your entire application would be isolated in use cases objects.
- Validations and callbacks are isolated to specific use cases and never interfere with each other.
- It’s easy to find where to update each story when demands change.

I imagine the boilerplate problem (and the ‘ah..different…nooooo’ problem) could be easily solved with a rails generate use\_case CreateABand name, tag\_list or similar.

I think unless I am missing something, I would like to see Rails move from its version of MVC to MVCU (the U being a UseCaseModel). I would like to see a generator that generates the test files and the UseCase model as well as the controller. I also have a use_case_spec_helper that is much lighter and does not load all of Rails for running use case specs.

I know a lot of people will say this is overkill, but I remember that is what people said when Rails was forcing MVC on us and telling us to trust them, because it was worth it in the end. I don’t think this is too much of a change and I think would make life easier on us who work on larger applications and those of us who hope our applications will be large one day.
