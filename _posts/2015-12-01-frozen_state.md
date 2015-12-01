---
published: true
layout: post
author: Enric Ribas
date: 2015-12-01T00:00:00.000Z
description: Frozen State
categories: 
  - news
---



This is a followup to my previous post about  [React with a Flux-y store](http://www.enricribas.com/fluxy/)

> Sidenote: I am looking seriously into Redux, but haven't made the move yet. 

One thing I really enjoy is using freezer to directly modify the local data and having freezer update itself and therefore all the views. 

Another thing I noticed is that the when you need to persist the changes to the server, Reflux actions are a very nice way to define the change. However, it is a pain to have to define an action, create an endpoint, deal with the returned data, etc., each time you add a new action.

While React is the new-hotness on the client-side, for me, at least, EventSourcing and CQRS are the new-hotness (ok, not new but growing in popularity) for the server side. On reading about this, I have noticed a strong similarity between "Commands" on the server and "Actions" on the client side.

So, I was thinking, why not create a single endpoint on the server that accepts "actions" and converts to server "commands"? 

> Sidenote: 

> This is orthogonal to using something like GraphQL. It doesn't exclude or replace its use but it doesn't require it either. Adding GraphQL to this process would be quite easy.

If you look at the example from my previous post...
```
// recipe.jsx

var Actions = require('actions');

 ...

  onClick: function (e) {
    this.props.name.set("New Recipe Name");
    // current way of calling store
    Actions.changeName(this.props.id, "New Recipe Name");
  }
}

module.exports = Recipe;
```

Previously, this would have made a call to a store method which then calls an explicit endpoint on the server specifically for changing the name, and then the store would have dealt with the data returned. This works but is time-consuming and repetitive.

You can now imagine that the Actions store could simply call an endpoint on the server with the method name and the data and all other "actions" would also hit the same endpoint. For simplicity, you might want to change the Actions call...

```
  onClick: function (e) {
    Actions.command("changeName", {id: this.props.id, name: "New Recipe Name");
  }

```

The actions store would simply delegate to the endpoint.
```
  ...

  onCommand: function (command, attrs) {
    // fetch polyfill
    fetch('/commands/' + command, attrs);
  }

  ...
```

Once this is done, adding a new action would not require any changes to the store. 

On the server side (Rails) you would need a CommandController

```
class CommandsController < ApplicationController
  def create
    if CommandRunner.run(command, params[:body])
      render json: {}, status: :ok #for now
    else
      render json: {
        error: ["something went wrong"]
      }, status: 422
    end
  end

  private

  def command
    params[:command]
  end
end
```

If we wanted to get really fancy here, we could use something like [RailsDisco](https://github.com/hicknhack-software/rails-disco) for full event sourcing or use [CommandObjects](http://knewter.github.io/rails-on-objects-presentation/#intro) or use our own implementation for now.

```
class CommandRunner
  def self.run(command, params)
    runner = runners[command]
    runner.new(params).run
  end

  private

  def self.runners
    {
      changeName: NameChanger,
      addIngredient: IngredientAdder,
    }.with_indifferent_access
  end

  class Runner < Struct.new(:params)
  end

  # These would probably be in a different file
  class NameChanger < Runner
    def run
      Recipe.find ...
      etc ....
    end
  end

  class IngredientAdder < Runner
    def run
      Recipe.find... 
      etc ...
    end
  end
end
```

> SideNote: CommandObject by Josh Adams, a nicer implementation of Command Objects

```
class StudentTransferCommandsController < LoggedInController
  def create
    transfer = StudentTransferCommand.new(params[:student_transfer_command])
    transfer.student_id = current_person.id
    transfer.on_success = method(:on_success)
    transfer.on_failure = method(:on_failure)
    transfer.execute!
  end

  def on_success
    flash[:success] = "Transfer successful."
    redirect_to bank_path
  end

  def on_failure
    flash[:error] = "Invalid transfer."
    redirect_to bank_path
  end
end
```

So we still have to deal with the response data from the server. What if we try to save but it fails for some reason?

Ideally, we would use something like Pusher to post back the data as it changes, but that's a topic for another post. For now, we can have the store listen to the response with a callback.

```javascript
  ... more code

  onCommand: function (command, attrs) {
    // using polyfill fetch
    fetch('/commands/' + command, attrs)
      .then(function(response) {
        return response.json();
      }).then(function(json) {
        // Because we're using freezer, this will trigger Reflux to update
        // This also implies that we are updating the entire tree of data
        // which is not efficient. 
        // Ideally we would only replace the portion of tree that changed.
        this.store.get().set(json);
      }).catch(function(ex) {
        console.log('deal with me!', ex);
      })
    ;
  }

  ... more code
```

The controller would of course have to return some data

```
class CommandsController < ApplicationController
  def create
    if id = CommandRunner.run(command, params[:body])
      # all_data is pseudo-code of course
      render json: all_data(id), status: :ok
  
      ...
end
```

We are making the assumption that the data returned from the server completely replaces the data on the client-side. While this might work for smaller apps, this is not great. We probably should return a subset of the changed data and replace/merge it with our existing data. We'll leave that for another day as well.

### Conclusion

So I think that by updating the data on the frontend with freezer and calling a "command" on the front-end, we have greatly simplified the front-end. Now the backend gets a command from the front-end (aka "action") and it returns data after updating. Essentially, the store shouldn't have to do much at all, just delegate to the server.

I think this is a nice clean way of dealing with changes. What do you think?
