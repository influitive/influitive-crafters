---
published: false
---


If you are a web developer looking to broaden your horizons regarding JavaScript, to take the leap from using it for simple DOM scripting, to writing complex, well structured programs, I offer some modest advice. To borrow a phrase - with tongue in cheek - if you think you understand JavaScript functions, you don't understand JavaScript functions. 

Assuming that like me, the language that most significantly defined your programmer's imagination is a classical, object-oriented one, your conception of a function/method may be limiting your appreciation of how critical they are as constructs for structuring JavaScript programs. Where the language you know best might have a range of explicit constructs for expressing structure, such as classes, modules, mixins, interfaces, and namespaces, JavaScript's support of similar constructs is implicit in most cases, there is no special syntax denoting them. Instead, many structures (the ones mentioned and beyond) can be expressed in JavaScript using functions themselves for the most part. This is the language's very paradigm, a dynamism built around functions that support features that when used in combination are very expressive, like closure, functional scope, *this*, and immediate invocation.

Unless you are very new to the language, you've likely already used a JS function to express structure, or at least seen an example of someone else doing so, without feeling like you could spontaneously create or manipulate such idioms yourself. In order to be able to, I encourage a conceptual shift in the way you look at the language, one that took me a while to make, but was a significant, personal a-ha moment. For a long time I worked with - and copied - JS patterns for namespaces, mixins, and private members under the impression that they were clever, but arbitrary hacks, that made the best of a clunky language. It was after I was able to let go of my assumptions of what methods/functions should be, and appreciate their very broad role in JS, that I started being able to use them to express structure in JS with a rudimentary fluency. I can now negotiate the structural possibilities of the language, improvising on structural patterns when need be, rather than finding them mysterious, adhering closely to patterns I've inherited, for fear of making a wrong move, as I did before. 

To illustrate what I mean, here’s an example of how differently I would approach writing the same JS structure before and after my conceptual leap. I’ve chosen a trivial one for the example, to keep things simple: an interface/cache for getting and setting the value of a cookie with a key of ‘flavour’. 

Previously, I would probably have reached for an object literal, and written something like this. 

```JavaScript 
cookieFlavour = {

  flavour: undefined,
  cookieKey: 'flavour',

  get: function() {
    return this.flavour || 
    	(this.flavour = jQuery.cookie(this.cookieKey));
  },

  set: function(val) {
    this.flavour = val;
    jQuery.cookie(this.cookieKey, this.flavour);
  }
};
```

On the other hand, today I might define the object as the return value of an immediately executing function, and use the getter and setter methods as closures, in order to define the ‘flavour’, and ‘cookieKey’ members as de facto private, like so. 

```JavaScript
cookieFlavour = function() {

  var flavour,
      cookieKey = 'flavour';

  return {
    get: function() {
      return flavour || 
      	(flavour = jQuery.cookie(cookieKey));
    },

    set: function(val) {
      jQuery.cookie(cookieKey, val);
      flavour = val;
    }
  };
}();
```
Using the ‘cookieFlavour’ object would look the very same in both cases, it's only the implementation that's different.

```JavaScript
cookieFlavour.set(‘chocolate chip’);
alert(‘Your cookie flavour is ’ + cookieFlavour.get()); 
```

Of course this is only one example, and a simple one at that, of how JavaScript functions can be used to define structure.

If this post vaguely resonates with you, if you want to make the conceptual shift I’m advising but aren’t quite sure how, I highly recommend reading [JavaScript Patterns](http://www.amazon.com/JavaScript-Patterns-Stoyan-Stefanov/dp/0596806752) by Stoyan Stefanov, the book that got me over the hump. It doesn’t flesh out the concept explicitly as much as lead one to it - among other insights - by showing how to express a number of common classical, OO structures in JavaScript. As with a human language, it seems that learning a programming one is sometimes a matter of getting familiar with its idioms until, by osmosis, its internal logic becomes apparent. 

Happy JavaScripting.