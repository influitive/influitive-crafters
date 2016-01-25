---
layout: post
published: true
title:  "Chain of Responsibility for web requests"
author: "Sundeep Gupta"
date:   2016-01-19
description : "A technique to optionally handle web requests in an extendable way"
categories:
  - news
---

## Summary
We describe the application of the Chain of Responsibility pattern to help with handling web requests inside of an iOS web view. We start with some background and context around the problem, then move to implement the technique to resolve it. The example is done in the Swift language. 


## Background
Our iOS native app contains a web view to allow users to interact with a complex web app. In this simplified example, we will have a view controller, `WebViewController`, which has the UIWebView property called `webView`. We assign `webView`'s `WKNavigationDelegate` to `WebViewController`. `WKNavigationDelegate` is used to  handle any HTTP requests `webView` makes. 

	import UIKit
	import WebKit
	
	class WebViewController: UIViewController, WKNavigationDelegate {
	    var webView: WKWebView!
	
	    override func viewDidLoad() {
	        super.viewDidLoad()
	
	        self.setupWebView()
	    }
	    
        func logout() {
	        // code to log out
	    }
	    
	    func showAboutView() {
	        // code to show the About view
	    }
	
	    func webView(webView: WKWebView, decidePolicyForNavigationAction navigationAction: WKNavigationAction, decisionHandler: (WKNavigationActionPolicy) -> Void) {
	        let path = navigationAction.request.URL!.path
		    if path == "sign_out" {
		        // code to handle logging out
		        decisionHandler(.Cancel)
		        return
		    } else if path == "about" {
		        // code to show a native About view
		
		        decisionHandler(.Cancel)
		        return
		    }
		
		    decisionHandler(.Allow)
	    }
	    
	    private func setupWebView() {
	        self.webView = WKWebView(frame: self.view.frame)
	        self.webView.navigationDelegate = self
	        self.view.addSubview(webView)
	    }
	}

You can see in the delegate method `webView:decidePolicyForNavigationAction:decisionHandler`, there is some conditional code to handle the request and we either allow the web view to continue processing it, or we stop it. 


### Problem
Handling requests in this way poses a problem when there are more then just a couple. As development continues and more cases arise, it's clear we'll need to solve this in a better way. It sounds like the perfect case for the object oriented Chain of Responsibility design pattern.



## Chain of Responsibility pattern
Quickly, the [Chain of Responsibility pattern](https://en.wikipedia.org/wiki/Chain-of-responsibility_pattern) lets a request pass through multiple "links" of a chain. If a link handles the request, we're done and we bail. Otherwise, the request is passed to the next link in the chain.

### Implementation
In our example, we want to process each HTTP request by sending it through a chain of potential handlers. And once a handler handles the request (like showing the native About view) we clearly don't want or need the other handlers to do anything. We handled it, so stop processing the request. Lets start backwards by figuring out what we want our delegate method to look like:

#### Client code
	func webView(webView: WKWebView, decidePolicyForNavigationAction navigationAction: WKNavigationAction, decisionHandler: (WKNavigationActionPolicy) -> Void) {
	    let handled = self.requestChain.handle(request: navigationAction.request, controller: self)
	    if handled {
	        decisionHandler(.Cancel)
	    } else {
	        decisionHandler(.Allow)
	    }
	}

A couple of things to note here. We've introduced the chain object, `requestChain`, which has the `handle` method. We'll get into this object in a bit, but for now, notice we simply check to see if the chain handled the request or not. More precisely, if any of the handlers (links), that make up the chain, handled the request. If so, stop `webView` from handling the request.

#### Chain code
To implement the chain, we need three components:
1. The link protocol (also known as an interface in other languages, like Java).
2. The concrete link classes.
3. The chain class, which holds the links.


##### Links
	protocol RequestHandler {
	    func handle(request request: NSURLRequest, controller: WebViewController) -> Bool
	}

Each handler in our chain will take a request, and possibly handle it. And it returns a Bool to indicate if it handled it or not. If you're wondering why we're passing the `controller` argument, it's because in this contrived example, we'll call methods on `controller` to handle requests. In general, you may want to pass in different objects, or a closure instead. 

Lets look at an example of a concrete class:

	class logoutHandler: RequestHandler {
	    func handle(request request: NSURLRequest, controller: WebViewController) -> Bool {
	        if request.URL!.path == "logout" {
	            controller.logout()
	            return true
	        }
	
	        return false
	    }
	}

The class implements the protocol's `handle` method, by inspecting the request and conditionally handling it. All concrete `RequestHandler` classes would behave in this similar way. Here's another:

	class AboutHandler: RequestHandler {
	    func handle(request request: NSURLRequest, controller: WebViewController) -> Bool {
	        if request.URL!.path == "about" {
	            controller.showAboutView()
	            return true
	        }
	
	        return false
	    }
	}


##### Chain
Now that we know what our links look like, lets put them together in our chain class, `RequestChain`.

	class RequestChain {
	    var handlers: [RequestHandler]!
	
	    init(handlers: [RequestHandler]) {
	        self.handlers = handlers
	    }
	
	    func handle(request request: NSURLRequest, controller: WebViewController) -> Bool {
	        for handler in self.handlers {
	            let handled = handler.handle(request: request, controller: controller)
	            if handled {
	                return true
	            }
	        }
	
	        return false
	    }
	}


We initialize our `RequestChain` with an array of `RequestHandlers` so we can loop over them when we want to process a request. Obviously, this is a very basic implementation and we could make this more sophisticated with guards, ability to add and remove handlers, etc. Also, you may notice that the `handle` method signature, is exactly the same as the `RequestHandler` protocol's. This is a natural thing to do, but it doesn't have to be this way, depending on your preference and scenario. In the `handle` method, we traverse chain of links and return once one of them handles the request.


#### Client code revised
Now that we have our chain setup, we simply need to instantiate and hook everything up. Here's the final version of our `WebViewController`:

	class WebViewController: UIViewController, WKNavigationDelegate {
	    var webView: WKWebView!
	    var requestChain: RequestChain!
	
	    override func viewDidLoad() {
	        super.viewDidLoad()
	
	        self.setupWebView()
	        self.setupRequestChain()
	    }
	
	    func webView(webView: WKWebView, decidePolicyForNavigationAction navigationAction: WKNavigationAction, decisionHandler: (WKNavigationActionPolicy) -> Void) {
	        let handled = self.requestChain.handle(request: navigationAction.request, controller: self)
	        if handled {
	            decisionHandler(.Cancel)
	        } else {
	            decisionHandler(.Allow)
	        }
	    }
	
	    func logout() {
	        // code to log out
	    }
	
	    func showAboutView() {
	        // code to show the About view
	    }
	
	    private func setupWebView() {
	        self.webView = WKWebView(frame: self.view.frame)
	        self.webView.navigationDelegate = self
	        self.view.addSubview(webView)
	    }
	
	    private func setupRequestChain() {
	        let handlers: [RequestHandler] = [LogoutHandler(), AboutHandler()]
	        self.requestChain = RequestChain(handlers: handlers)
	    }
	}


## Conclusion
The Chain of Responsibility pattern provides a clean, extendable way to handle HTTP requests from a web view. Need to handle requests in more ways?  No problem, just create new concrete `RequestHandler` classes, and add them into the chain. Our code is now [open for extension, and closed for modification](https://en.wikipedia.org/wiki/Open/closed_principle). 
