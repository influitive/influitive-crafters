---
layout: post
published: false
title:  "Extracting meaningful data from the web. Pt.2"
author: "Eduardo Poleo"
date:   2015-10-20
description : "Integrating rails APIs with js dynamic frameworks to create interactive sites"
categories:
  - development
---

On my previous post we scraped some data and dumped it into three different endpoints, effectively converting our simple application into a JSON api. In this post I am going to show how we can use use AJAX and D3 to retrieve this data and render our view elements, which in this case are going to be awesome dynamic plots.

In addition to our JSON end-points we are also going to need an endpoint to serve our html and assets (js and css files). Our route file can then look similar to this:

```ruby
#routes.rb
root 'staff#vertical'
#Main route where we are going to bootstrap our application
get 'vertical' => 'staff#vertical'

#Routes where we are dumping the JSON data.
get 'all_salaries' => 'averages#all_salaries', defaults: { format:  'json' }
get 'professors_only' => 'averages#professors_only', defaults:  { format: 'json' }
get 'administrative_staff' => 'averages#administrative_staff', defaults: { format: 'json' }
```
We want to link each route to a radio button so that users can switch between different datasets. So we are going to add a radio button menu to our main view:

```html
<!-- views/staff/vertical.html.erb -->
<%= form_tag() do %>
  <%= radio_button_tag(:average, "all_salaries", true, class: 'choice') %>
  <%= label_tag(:average_all_salaries, "All Salaries") %>
  <%= radio_button_tag(:average, "professors_only", false,  class: 'choice') %>
  <%= label_tag(:average_professors_only, "Professors Only") %>
  <%= radio_button_tag(:average, "administrative_staff", false, class: 'choice') %>
   <%= label_tag(:average_administrative_staff, "Administrative Staff") %>
<% end %>
```

We don't really need to set any specific form action/route in the ```form_tag``` because we are not going submit the form. Instead, we are going to hijack the click event and then perform an AJAX call to retrieve the corresponding dataset.

Note how the radio buttons have a class ```choice``` and their values are set to match the routes where we are dumping the JSON data (e.g ```all_salaries```). This is intentional as we want to simplify our javascript logic down the road.

We can then write the ajax code that we are going to use to retrieve the data from the JSON endpoints.

```javascript
$(function() {
  //Captures the click event
  $('.choice').click(function(e) {
  	//extracts the value of the radio button that was clicked which corresponds to a JSON route.
    var url = e.target.defaultValue
    //makes the corresponding ajax call
    ajax_call(url, update)
  });

  function ajax_call(url, callback) {
    $.ajax({
     type: "GET",
     contentType: "application/json; charset=utf-8",
     url: url,
     dataType: 'json',
     success: function (data) {
     //The callback would be draw() or update() depending on whether we are drawing the plot for the first time or we are updating it after the user clicks a radio button.
       callback(data["averages"])
     },
     error: function (result) {
         error();
     }
    });
  }
}
```
Because of the way D3 works we will need to use our ```ajax_call``` function in two different cases: when we first ```draw``` the plot, and when we ```update``` it after the user clicks one of the radio buttons. In order to dry out our code we can make the ```ajax_call``` accept a callback function for each case.

Now that we have wired up the data retrieval to the radio buttons, we can start writing our actual D3 code. First we will need to do define some general parameters and create some reusable functions:

<small>
NOTE: I do not intent to go into details on how D3 works in this post. This is a very big topic deserving of a entire [book](http://chimera.labs.oreilly.com/books/1230000000345/index.html). I will add the code in this post for completeness but the idea of this specific series is to show how we can we deviate from the conventional rails rendering to use more interactive js libraries such D3.
</small>

```javascript
//Sets plot's dimensions and other relevant values as paddings and margins
var w = 1000
var h = 1250

var xPadding = 10
var yPadding = 20

var xMargin = 200
var yMargin = 0

var rectMargin = 5

//Caculates the scales used for x, y and yAxis
function calculateScales(dataSet) {
  var xScale = d3.scale.linear()
                            .domain([0, 246000])
                            .range([xPadding, w - xMargin - xPadding])

//This scale ensures that the rectangles will be placed in the right spot along the y axis
  var yScale = d3.scale.ordinal()
                            .domain(d3.range(dataSet.length))
                            .rangeRoundBands([0, (h - 1.2 * yPadding )], 0.05)

//This is an special scale for the yaxis which uses ordinal values corresponding to the name of the universities
  var yAxisScale = d3.scale.ordinal()
                            .domain(dataSet.map(function (d) {
                              return d.university
                            }))
                            .rangeRoundBands([0, (h - 1.2 * yPadding )], 0.05)

  return [xScale, yScale, yAxisScale]
}

//Calculates the plot axes using the previously defined scale values
function calculateAxes(xScale, yAxisScale) {
  var xAxis = d3.svg.axis()
                  .scale(xScale)
                  .orient("bottom")
                  .ticks(5)

  var yAxis = d3.svg.axis()
                  .scale(yAxisScale)
                  .orient("left")

  return [xAxis, yAxis]
}
```
Every time we update our plot we will need to recalculate the scales and axes to account for differences in each dataset (number of points, max values, etc). Thus, it makes sense to create reusable functions so that we are not repeating this code all over place.

With the set up in place we can write up our ```draw``` and ```update``` functions which ultimately will do the heavy-lifting when drawing the plots.

```javascript
  function draw(dataSet) {
	//Appends a svg element and sets its dimensions using w and h
    svg = d3.select('body')
                  .append('svg')
                  .attr("width", w)
                  .attr("height", h)
                  .attr("class", "graph")
                  .append('g')
                  .attr("transform", "translate(" + xMargin + "," + yMargin + ")")
    //Calculates the scales with the initial data set (in this case the overall_salaries data)
    var scales = calculateScales(dataSet)
    var xScale = scales[0]
    var yScale = scales[1]
    var yAxisScale = scales[2]

    //Calculates the axes by using the previously calculated scales
    var axes = calculateAxes(xScale, yAxisScale)
    var xAxis = axes[0]
    var yAxis = axes[1]

    //Bounds each data point to a rectangle and then sets rectangle properties (enter selection)
    //for more info about data join and selections check http://bost.ocks.org/mike/join/
    rects = svg.append('g')
                .attr("class", "rects")
                .selectAll('rect')
                .data(dataSet)
                .enter()
                .append("rect")
                .attr("x", xPadding)

                .attr("y", function (d, i) {
                  return yScale(i)
                })
                .attr("width", function (d) {
                  return xScale(d.average_salary)
                })
                .attr("height", function () {
                  return h/dataSet.length - rectMargin
                })
	//Bounds each data point to a text label and sets the properties of the label
     svg.append('g')
          .attr('class', "labels")
          .selectAll("text")
          .data(dataSet)
          .enter()
          .append("text")
          .text(function (d) {
            return "$" + d.average_salary.toFixed(2).replace(/(\d)(?=(\d{3})+\.)/g, '$1,');
          })
          .attr("x", function (d) {
            return xScale(d.average_salary) - 40 //magic
          })
          .attr("class", "amount")
          .attr("text-anchor", "middle")
          .attr("y", function (d, i) {
            return yScale(i) + yScale.rangeBand() / 1.7;//magic
          })
          .attr("font-family", "sans-serif")
          .attr("font-size", "11px")
          .attr("fill", "red");

//Calls the x axis and groups all its labels under a svg group ('g') element
      svg.append("g")
          .attr("class", "x axis")
          .attr("transform", "translate(0," + (h - yPadding) + ")")
          .call(xAxis);

//Calls the y axis and groups all its labels under a svg group ('g') element
      svg.append("g")
          .attr("class", "y axis")
          .call(yAxis);
  }
```
The update function will get triggered every time the user clicks on a radio button. Its main responsibility will be to dynamically update the rectangles, axis and scales to account for changes in the ```dataSet```.

```javascript
function update(dataSet) {
	//Calculates the scales from the data set
    var scales = calculateScales(dataSet)
    var xScale = scales[0]
    var yScale = scales[1]
    var yAxisScale = scales[2]

    //Calculates the axes using the previous calculated scales
    var axes = calculateAxes(xScale, yAxisScale)
    var xAxis = axes[0]
    var yAxis = axes[1]

    //Since our data is in JSON format we need to define a key function to help D3 keep track of data points order. For more info check:
//http://chimera.labs.oreilly.com/books/1230000000345/ch09.html#_data_joins_with_keys
    var key = function(d) {
      return d.university;
    };

// Select all the existing rectangles before updating the the
    var rects = d3.select(".rects")
                  .selectAll("rect")
                  .data(dataSet, key)

// Adds additional rectangles if the dataset contains additional points and applies the corresponding attributes
    rects.enter()
      .append("rect")
      .attr("x", xPadding)
      .attr("y", function (d, i) {
        return yScale(i)
      })
      .attr("width", function (d) {
        return xScale(d.average_salary)
      })
      .attr("height", function () {
        return h/dataSet.length - rectMargin
      })

// Remove the extra rectangles if the current dataset is smaller than the previous one
    rects.exit()
      .transition()
      .duration(500)
      .attr("x", w)  // <-- Exit stage left
      .remove();

// Updates all the rectangles to accommodate the new data passed in
    rects.transition()
      .duration(500)
      .attr("x", xPadding)
      .attr("y", function (d, i) {
        return yScale(i)
      })
      .attr("width", function (d) {
        return xScale(d.average_salary)
      })
      .attr("height", function () {
        return h/dataSet.length - rectMargin
      })


// Select all the existing labels
    var labels = d3.select('.labels')
                     .selectAll('.amount')
                     .data(dataSet, key)

//Adds additional labels if the dataset contains additional points and applies the corresponding attributes
    labels.enter()
            .append("text")
            .text(function (d) {
              return "$" + d.average_salary.toFixed(2).replace(/(\d)(?=(\d{3})+\.)/g, '$1,');
            })
            .attr("x", function (d) {
              return xScale(d.average_salary) - 40 //magic
            })
            .attr("text-anchor", "middle")
            .attr("class", "amount")
            .attr("y", function (d, i) {
              return yScale(i) + yScale.rangeBand() / 1.7;//magic
            })
            .attr("font-family", "sans-serif")
            .attr("font-size", "11px")
            .attr("fill", "red")

// Remove the extra labels if the current dataset is smaller than the previous one
	labels.exit()
            .transition()
            .duration(500)
            .attr("x", w)  // <-- Exit stage left
            .remove();

// Updates all labels to accommodate the new data passed in
    labels.transition()
           .duration(500)
           .text(function (d) {
             return "$" + d.average_salary.toFixed(2).replace(/(\d)(?=(\d{3})+\.)/g, '$1,');
           })
           .attr("x", function (d) {
             return xScale(d.average_salary) - 40 //magic
           })
           .attr("text-anchor", "middle")
           .attr("class", "amount")
           .attr("y", function (d, i) {
             return yScale(i) + yScale.rangeBand() / 1.7;//magic
           })
           .attr("font-family", "sans-serif")
           .attr("font-size", "11px")
           .attr("fill", "red");

//Updates the axes
    svg.select(".x.axis")
          .transition()
          .duration(1000)
          .call(xAxis);

    svg.select(".y.axis")
          .transition()
          .duration(1000)
          .call(yAxis);
  }
```
You can check out the final result in [here](https://thawing-bayou-9932.herokuapp.com/) and the full code is on this [repo](https://github.com/eduardopoleo/web_scraper).
Hope you guys enjoyed this short series on Rails/JSON/APIs and JS front-end rendering!

Happy coding.
