﻿/// <reference path="../lib/jquery-2.1.4.min.js" />
/// <reference path="../lib/history.min.js" />

function startsWith(str, prefix) {
  if (str.length < prefix.length)
    return false;
  for (var i = prefix.length - 1; (i >= 0) && (str[i] === prefix[i]); --i)
    continue;
  return i < 0;
}

function escapeHTML(s) {
  return s.replace(/&/g, '&amp;')
          .replace(/"/g, '&quot;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
}

var wsPage = (function () {
  "use strict";

  var reqId = 0; // Current page load request ID. If page has moved on, earlier requests ignored when they complete.
  var location = null; // Full location, as seen in navbar
  var path = null; // Path after domain name
  var rel = null; // Relative path (path without language ID at start)

  // Page init scripts for each page (identified by relPath).
  var initScripts = {};

  // Parse full path, language, and relative path from URL
  function parseLocation() {
    location = window.history.location || window.location;
    var rePath = /https?:\/\/[^\/]+(.*)/i;
    var match = rePath.exec(location);
    path = match[1];
    rel = path;
  }

  function initDebug() {
    var dbgHtml = "<div id='debug'></div>";
    $(dbgHtml).appendTo("body");
    updateDebug();
    $(window).resize(updateDebug);
  }

  function updateDebug() {
    var clientw = document.body.clientWidth;
    var testw = $("#wtest").width();
    var dbgHtml = "ClW: " + clientw + " TestW: " + testw;
    $("#debug").html(dbgHtml);
  }

  function adaptToSize() {
    var clientw = document.body.clientWidth;
    var testw = $("#wtest").width();
    if (clientw <= testw) $("body").addClass("narrow");
    else $("body").removeClass("narrow");
    if (clientw <= testw * 0.6) $("body").addClass("verynarrow");
    else $("body").removeClass("verynarrow");
  }

  // Page just loaded: time to get dynamic part asynchronously, wherever we just landed
  $(document).ready(function () {
    // Debug
    //initDebug();

    // Handcrafted adaptive layout
    adaptToSize();

    // Make sense of location
    parseLocation();
    // Update menu to show where I am (will soon end up being)
    updateMenuState();
    // Overall UI event handlers, including cookie bar
    initGui();
    // Request dynamic page - async
    // Skipped if we received page with content present already
    var hasContent = $("body").hasClass("has-initial-content");
    if (!hasContent) {
      ++reqId;
      var id = reqId;
      var data = { rel: rel };
      // Submit request
      var req = $.ajax({
        url: "/api/getpage",
        type: "POST",
        contentType: "application/x-www-form-urlencoded; charset=UTF-8",
        data: data
      });
      req.done(function (data) {
        if (data == undefined || data == null) applyFailHtml();
        else dynReady(data, id);
      });
      req.fail(function (jqXHR, textStatus, error) {
        applyFailHtml();
      });
    }
    // If page has initial content, trigger dyn-content-loaded activities right now
    if (hasContent) dynReady(null, -1);
  });

  // Navigate within single-page app (invoked from link click handler)
  function dynNavigate() {
    // Make sense of location
    parseLocation();
    // Clear whatever's currently shown
    $("#content").addClass("fading");
    // Update menu to show where I am (will soon end up being)
    updateMenuState();
    // Request dynamic page - async
    ++reqId;
    var id = reqId;
    var data = { rel: rel };
    // Submit request
    var req = $.ajax({
      url: "/api/getpage",
      type: "POST",
      contentType: "application/x-www-form-urlencoded; charset=UTF-8",
      data: data
    });
    req.done(function (data) {
      if (data == undefined || data == null) applyFailHtml();
      else navReady(data, id);
    });
    req.fail(function (jqXHR, textStatus, error) {
      applyFailHtml();
    });
  }

  // Show error content in dynamic area
  function applyFailHtml() {
    $("#content").html("Ouch.");
    // TO-DO: fail title; keywords; description
  }

  // Calls initializers registered for this page.
  function initCurrentPage(data) {
    // Run this page's script initializer, if any
    for (var key in initScripts) {
      if (key == "/") {
        if (rel == "/") initScripts[key](data);
      }
      else if (startsWith(rel, key)) initScripts[key](data);
    }
  }

  // Apply dynamic content: HTML body, title, description, keywords; possible other data
  function applyDynContent(data) {
    if (data.noIndex) $('meta[name=robots]').attr("content", "noindex");
    else $('meta[name=robots]').attr("content", "");
    $(document).attr("title", data.title);
    $("#content").html(data.html);
    $("#content").removeClass("fading");
    // Init page
    initCurrentPage();
    // Scroll to top
    $(window).scrollTop(0);
  }

  function navReady(data, id) {
    // An obsolete request completing too late?
    if (id != reqId) return;

    // Show dynamic content, title etc.
    applyDynContent(data);
    // GA single-page navigation
    ga('set', 'page', path);
    ga('send', {
      hitType: 'pageview',
      page: path,
      title: data.title
    });
  }

  // Dynamic data received after initial page load (not within single-page navigation)
  function dynReady(data, id) {
    // An obsolete request completing too late?
    if (id != -1 && id != reqId) return;

    // Show dynamic content, title etc.
    // Data is null if we're call directly from page load (content already present)
    // BUT: We must still called registered page initializers
    if (data != null) applyDynContent(data);
    else initCurrentPage(data);

    // Set up single-page navigation
    $(document).on('click', 'a.ajax', function () {
      // Navigate
      history.pushState(null, null, this.href);
      dynNavigate();
      return false;
    });
    $(window).on('popstate', function (e) {
      dynNavigate();
    });
  }

  // General UI event wireup
  function initGui() {
    // Cookie warning / opt-in pest
    var cookies = localStorage.getItem("cookies");
    if (cookies != "go") $("#bittercookie").css("display", "block");
    $("#swallowbitterpill").click(function (evt) {
      $("#bittercookie").css("display", "none");
      localStorage.setItem("cookies", "go");
      evt.preventDefault();
    });
    // Link to imprint
    $("#imprint").click(function () {
      window.open("/impressum");
    });
  }

  // Updates top navigation menu to reflect where we are
  function updateMenuState() {
    $("#header-menu a").removeClass("selected");
    if (rel == "/" || startsWith(rel, "/ergebnis")) $("#lnkTest").addClass("selected");
    else if (startsWith(rel, "/hintergrund")) $("#lnkBackground").addClass("selected");
  }

  return {
    // Called by page-specific controller scripts to register themselves in single-page app, when page is navigated to.
    registerInitScript: function (pageRel, init) {
      initScripts[pageRel] = init;
    },

    // Retrieves relative URL of current page.
    getRel: function() {
      return rel;
    },

    // Navigates to provided relative URL, respecting single-page navigation.
    navigateTo: function (url) {
      history.pushState(null, null, url);
      dynNavigate();
    }
  };

})();
