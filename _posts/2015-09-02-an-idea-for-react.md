---
layout: post
title:  "An idea for React with a Flux-y data store"
author: "Enric Ribas"
date:   2015-09-02 15:38:50
categories:
  - news
---

## Using Reflux and Freezer as data store

React is an amazing advancement in web development. It creates an implementation that is simple to create, reuse, and understand. It has strong opinions about front-end rendering but it has no opinion about how data is stored, manipulated and then persisted. I think that's a good thing. There are a lot of different use cases and opinions about the best way to handle data and it really shouldn't be part of React's responsibilities.

Flux was introduced shortly after React by Facebook as a pattern to try and solve this problem. There seems to be no major consensus on the best approach however. [Flux Comparison](https://github.com/voronianski/flux-comparison) is a comparison of many of the options currently available. Yet even that list is missing some options, like [Microcosm](https://github.com/vigetlabs/microcosm), so there are lots to choose from.

Personally, I find a combination of an immutable data structure and a simple implementation of Flux to be the best. First let's start with the immutable data store.

While there are a lot of more popular libraries for Flux and for immutability. I personally like [freezer.js](https://github.com/arqex/freezer) and [Reflux]() because... well... they are easy enough for me to understand.

If you find you need to switch, it much easier to start with these options and swap out later than to not use some form of flux or immutability, because the concepts will be the same.

#### Immutable Data

###### Freezer:

  * uses a simple api
  * doesn't require getters for accessing data
  * has events when someone tries to update the data structure.

Their github page has some great examples about how to use freezer but let's go directly to a practical example. I like to work with just one store (per route). Each route gets a store and a list of possible actions. All the data for that route is contained in the store passed to the uppermost component which I call a 'Container'.

Before we get into Reflux, let's just use immutability to update our components. We'll just use the Store but no Actions from Reflux, but this could be done just as easily without a Reflux Store.

```
//store.js
var Freezer = require('freezer-js');

var Store = Reflux.createStore({
  defaultData: {
    user:    undefined,
    recipes: []
  },

  init: function () {
    this.store = new Freezer(this.defaultData);

    this.store.on('update', function (newData) {
      // NOTE: Called every time data structure is modified

      // checks to see if data is actually changed
      if (this.data != newData) {
        this.data = this.store.get();
      }

      this.trigger(this.data);
    }.bind(this));
  }
});

module.exports = Store;

```

So ```this.data``` contains an immutable version of the data from the store ```this.store``` retrieved with the ```get()``` command. It will be this data that is passed into the 'Container' which will then pass a subset of that data into each component as props.

So how do we use that Store?

```
// app.js
var React         = require('react');
var Reflux        = require('reflux');

var Store         = require('store');
var SomeComponent = require('components/some');

var App = React.createClass({
  mixins: [Reflux.connect(Store, "data")],

  getInitialState: function() {
    return { data: {} };
  },

  render: function () {
    return (
      <div>
        <SomeComponent {...this.state.data.recipes} />
      </div>
    );
  }
});

module.exports = App;

```

So how is ```this.state.data.recipes``` getting its data? That's a bit of magic from Reflux. Again you could do this without Reflux but when we add Actions you will see how it's easier to keep with Reflux.

The magic is the ```Reflux.connect``` call which will update this.state.data (or whatever from the second argument) every time the Store calls a ```trigger``` method (in the store.js) with the data passed into the ```trigger``` method, in our case a copy of the immutable data from ```this.data```.

You can pass all of the data or only part of it to the sub-component. In our case, we are passing a subset in ```this.state.data.recipes``` but that will still be an immutable copy. Any changes to this data will result in a call to the ```this.store.on('update', ...``` method in our store. And therein lies the magic. Any change to any part of the data results in a change to the entire data structure updating everything at once.

If we take a look at a hypothetical version of a ```Recipe``` component further down the chain that gets one recipe passed as a prop...

```
// recipe.jsx

var React   = require('react');

var Recipe = React.createClass({
  render: function () {
    return (
      <div>
        <h1>{this.props.name}</h1>

        <p>{this.props.instructions}</p>

        ...more code
      </div>
    );
  },
 ...more code

  onClick: function (e) {
    // NOTE this.props.name is an immutable object
    this.props.name.set("New Recipe Name");
  }
}

module.exports = Recipe;
```

So if we wanted to change the name of the recipe, the ```set``` command would cause the store.js 's ````store.on('update', ...``` to run its code getting a new fresh immutable copy of the data from ```this.store``` and then passing that down again through ```trigger```

This makes it incredibly easy to ensure that all the components that rely on this data to be updated at once, once any of the data changes. For example, if you had a different section of the page that listed all the names of all the recipes, as soon as you changed the name in this component the name data would get fired and you would get new fresh data. React would be smart enough to only update the things that are changed. And because you are using an immutable structure, you can use ```shouldComponentUpdate``` to check javascript object equality and render only if the data changed.

#### Reflux

###### Persisting Data

So we can now make changes to the actual data structure and it is automatically reflected on our frontend. But what if the name is already taken? Or if we refresh the page? What if the rules for the data prevent that name change?

We need some more structure in order to persist. This is where the Reflux/Actions pattern comes in. If we modify our ```onClick``` method above...

```
```
// recipe.jsx

var Actions = require('actions');

 ...more code

  onClick: function (e) {
    // NOTE this.props.name is still an immutable object
    this.props.name.set("New Recipe Name");
    Actions.changeName(this.props.id, "New Recipe Name");
  }
}

module.exports = Recipe;
```

So where does changeName come from? Let's look at the actions.js file.

```
//actions.js

var Reflux = require('reflux');

module.exports = Reflux.createActions([
  "changeName"
]);

```

That's it. That's how you define an action in reflux. Ok, big deal what does that do? Let's return to the store.js and see what changes we need to make.

```
// store.js

var Reflux  = require('reflux');
var Freezer = require('freezer-js');

var Actions = require('actions');

var Store   = Reflux.createStore({
  defaultData: {
    user:    undefined,
    recipes: []
  },

  listenables: Actions,
  init: function () {
    this.store = new Freezer(this.defaultData);

    this.store.on('update', function (newData) {
      // NOTE: Called every time data structure is modified

      // checks to see if data is actually changed
      if (this.data != newData) {
        this.data = this.store.get();
      }

      this.trigger(this.data);
    }.bind(this));
  },

  onChangeName: function (recipe_id, newName) {
    // pseudocode alert
    request.post(...., function (dataFromServer) {
      // not pseudocode assuming replacing all data
      this.data.set(dataFromServer);
    }).bind(this);
  }
});

module.exports = Store;
```

I don't love magic and would prefer more explicit connection from the actions to the store, BUT, if you call an action ```changeName``` it will the ```onChangeName``` function on the store, assuming your store is `listening` to the Action file, which we do with the ```listenables``` method.

In our, onChangeName function, we can do whatever we want. We can client-side validate the data, we can make server requests, etc. Once the data comes back from the server it either completely replaces the data in ```this.data``` or merges in the parts that you are replacing. It's up to you. Because we are modifying the immutable data again with the ```set``` command, the ```on('update')``` will "repush" the data back down to the Container.

###### Conclusion

It seems we have a solution that is

  * easy to understand
  * easy to modify
  * easy to test
  * performant
  * ensures data consistency

What do you think? Is this easy to understand? Are there some problems with this approach? Is there a better way?
