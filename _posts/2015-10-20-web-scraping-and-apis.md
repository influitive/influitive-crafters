---
layout: post
published: true
title:  "Extracting meaningful data from the web"
author: "Eduardo Poleo"
date:   2015-11-17
description : "Integrating rails APIs with js dynamic frameworks to create interactive sites"
categories:
  - news
---

At Influitive a great deal of our app dumps JSON data at certain endpoints; this data is then processed and integrated with [React](https://facebook.github.io/react/) to generate highly interactive views. In this and a subsequent post I am going to show how we can use a similar process to generate interactive graphics using rails and the [D3](http://d3js.org/) library.

The data that we are going to use corresponds to the [Public Salary Disclosure of Universities 2014](http://www.fin.gov.on.ca/en/publications/salarydisclosure/pssd/orgs-tbs.php?year=2014&organization=universities&page=1) for Ontario. In this first post we are going to gather this data by means of web-scraping and dump it as JSON in different endpoints. In the following post we'll use the D3 library to generate dynamic web plots out of this data.

## Mechanize, Rails and Web-Scraping
We are going to use the [Mechanize](https://github.com/sparklemotion/mechanize) gem to gather our the data, but first we need to take a close look at the DOM structure we are about to scrape. Fortunately, the people of the Ontario government have created a nicely structured page that we can easily scrape. The snippet below shows the parts we really care about:

```html
<thead>
  <tr>
  	<td><a href="LinkToFirstPage">First Page</a> </td>
    <td>
      <a href="LinkToPage1">1</a>
      <a href="LinkToPage2">2</a>
      <a href="LinkToPage3">3</a>
      <a href="LinkToPage4">4</a>
    </td>
    <td><a href="LinkToLastPAge">Last Page</a> </td>
  </tr>
</thead>

<tbody>
  <tr>
    <td>
      <span>Super Duper University</span>
    </td>
  	<td>Doe</td>
  	<td>John</td>
  	<td>
      <span>Associate Professor</span>
    </td>
  	<td>$101,395.11</td>
  	<td>$7,541.94</td>
  </tr>
      <!--thousands of similar rows -->
</tbody>
```
There are few key things we need to note in here:
* The data is paginated which means that we will need to extract the number of pagination links and iterate over them to obtain the data from each page.
* Each row within the ```tbody``` maps to an individual's information although the structure is not 100% consistent because the ```university``` and the  ```title``` are wrapped inside span tags. So we will need to account for that in our script.
* Finally, since we want to store all the data in our database, every time we iterate over a full row we probably want to create a ```Staff``` record which is a Rails active record model.

With this in mind we can proceed and write the following web scraper.

```ruby
#lib/tasks/scrape.rake
#Mechanize setup
require 'mechanize'
agent = Mechanize.new

#The starting point which corresponds to page 1
page = agent.get('http://www.fin.gov.on.ca/en/publications/salarydisclosure/pssd/orgs-tbs.php?year=2014&organization=universities&page=1')

#Extracts all the pagination links over which we are going to iterate
page_links = page.search("//thead/tr/td[2]/a")

def cleaned_text(row, xpath)
  row.at(xpath).text.strip
end

def money_value(row, xpath)
  cleaned_text(row, xpath).tr("$,", "").to_f
end

page_links.each do |link|
  page.link_with(text: "#{link.text}").click

  puts "------>Scraping results for page #{link.text}<-----------"
  # row = agent.page.at('//tbody/tr[1]')
  rows = agent.page.search('//tbody/tr')

  rows.each do |row|
    Staff.create(
      university: cleaned_text(row, 'td[1]/span'),
      last_name: cleaned_text(row, 'td[2]'),
      name: cleaned_text(row, 'td[3]'),
      title: cleaned_text(row, 'td[4]/span'),
      salary: money_value(row, 'td[5]'),
      taxable_benefits: money_value(row, 'td[6]')
    )
  end
end
```
**NOTE**: I am using the [xpath notation](https://en.wikipedia.org/wiki/XPath) to dig into the DOM structure. Just if you were wondering what things like ```"//thead/tr/td[2]/a"``` were.

For the purpose of this study we want to calculate the average staff earning per university. Now if we take a closer look to our data we can see that the individuals that compose our records can generally be divided into two different groups: academic (professors) and administrative (non-professors). So we want to consider at least three different types of averages:

*   ```overall_salaries``` Professors + Administrative
*   ```professors_only``` Professors
*   ```administrative_only``` Administrative

Ideally, we want the data for each type of average being dumped as JSON into their own specific endpoint, so that users can easily filter the information they want to see. We could make the average calculations on the fly every time the user decides to switch endpoints. But this will either require a complex query or looping through all the ```Staff``` records every time, both of which can be cumbersome and slow.

Instead, we could do these calculations right after finishing scrapping the data and have it ready available (one simple query away) for when the user decides to request it. We can then write the following:

```ruby
#lib/tasks/scrape.rake
def salary_averages(staff, use_case)
  universities = staff.map{|p| p.university}.uniq
  data = []

  universities.each do |university|
    university_staff = staff.select{|s| s.university == university}
    average_salary = (university_staff.map{|p|  p.salary}.reduce(:+)/university_staff.count).round(2)

    Average.create(
      university: university,
      use_case: use_case,
      average_salary: average_salary
    )
  end
end

#Each of the following queries will filter the records by case. A use_case parameter is passed down so that we can refer to it later in the controller endpoints.
puts "------------>Calculating overall salaries<---------------"
staff = Staff.all
salary_averages(staff, "overall_salaries")

puts "------------>Calculating Professors only<---------------"
staff = Staff.where("title like ?", "%Professor%")
salary_averages(staff, "professors_only")

puts "------------>Calculating Administrative only<---------------"
staff = Staff.where("title not like ?", "%Professor%")
salary_averages(staff, "administrative_only")
```

Finally, all we need to do is to create three different end-points on the ```AverageController``` to dump the information into. We should also serialize the data so that we have an "easy to work with" format when we deal with in the front-end.

```ruby
#averages_controller.rb
class AveragesController < ApplicationController
  #Uses the use_case flag to query for the correct type of averages
  def all_salaries
    @data = Average.where(use_case: "overall_salaries")
    respond_to_block
  end

  def professors_only
    @data = Average.where(use_case: "professors_only")
    respond_to_block
  end

  def administrative_staff
    @data = Average.where(use_case: "administrative_only")
    respond_to_block
  end

  private
  def respond_to_block
    respond_to do |format|
      format.json { render json: @data }
    end
  end
end

#average.rb
class Average < ActiveRecord::Base
  # This is a rails magical thing that sets the structure of the JSON object that we are going to render
  def serializable_hash(options = {})
    {
      university: university,
      average_salary: average_salary
    }
  end
end
```
That's it for now the full code for the project can be found [here](https://github.com/eduardopoleo/web_scraper). On my next post I am going to show how to integrate D3 with rails and how to use the data we have gathered here to generate awesome web plots.

Hope you enjoyed the reading. Happy Coding!
