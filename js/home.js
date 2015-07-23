(function(){
  var Events = function(){
    var months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

    function determineEventsDate(){
      var eventDates = document.querySelectorAll(".event-list .event .event-date");

      for(var i = 0; i < eventDates.length; i++){
        _determineDate(eventDates[i]);
      }
    }

    function _determineDate(eventDate) {
      var date = new Date(eventDate.getAttribute("data-date"));
      var day = date.getDay();
      var month = date.getMonth();

      _setDate(eventDate, day);
      _setMonth(eventDate, month);
    }

    function _setDate(eventDate, day){
      eventDate.querySelector(".day").innerHTML = day;
    }

    function _setMonth(eventDate, month){
      eventDate.querySelector(".month").innerHTML = months[month];
    }

    return {
      determineEventsDate : determineEventsDate
    };
  };

  new Events().determineEventsDate();
})();
