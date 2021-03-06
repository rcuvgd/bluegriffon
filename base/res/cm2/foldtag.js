/*
 * HTML Folding
 * 
 * Copyright (C) 2011 by Daniel Glazman <daniel@glazman.org>
 * 
 * Adapted from https://github.com/marijnh/CodeMirror2/blob/master/lib/util/foldcode.js
 *
 * Used under MIT-style license of CodeMirror available from http://codemirror.net/LICENSE:
 *
 *      Copyright (C) 2011 by Marijn Haverbeke <marijnh@gmail.com>
 *      
 *      Permission is hereby granted, free of charge, to any person obtaining a copy
 *      of this software and associated documentation files (the "Software"), to deal
 *      in the Software without restriction, including without limitation the rights
 *      to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *      copies of the Software, and to permit persons to whom the Software is
 *      furnished to do so, subject to the following conditions:
 *      
 *      The above copyright notice and this permission notice shall be included in
 *      all copies or substantial portions of the Software.
 *      
 *      THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *      IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *      FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 *      AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *      LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *      OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 *      THE SOFTWARE.
 * 
 * This derivative work follows same licensing terms.
 */

CodeMirror.tagRangeFinder = function(cm, line) {
  var nameStartChar = "A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD";
  var nameChar = nameStartChar + "\-\.0-9\\u00B7\\u0300-\\u036F\\u203F-\\u2040";
  var xmlNAMERegExp = new RegExp("^[" + nameStartChar + "][" + nameChar + "]*");

  var lineText = cm.getLine(line);
  var found = false;
  var tag = null;
  var pos = 0;
  while (!found) {
    pos = lineText.indexOf("<", pos);
    if (-1 == pos) // no tag on line
      return;
    if (pos + 1 < lineText.length && lineText[pos + 1] == "/") { // closing tag
      pos++;
      continue;
    }
    // ok we weem to have a start tag
    if (!lineText.substr(pos + 1).match(xmlNAMERegExp)) { // not a tag name...
      pos++;
      continue;
    }
    var gtPos = lineText.indexOf(">", pos + 1);
    if (-1 == gtPos) { // end of start tag not in line
      var l = line + 1;
      var foundGt = false;
      var lastLine = cm.lineCount();
      while (l < lastLine && !foundGt) {
        var lt = cm.getLine(l);
        var gt = lt.indexOf(">");
        if (-1 != gt) { // found a >
          foundGt = true;
          var slash = lt.lastIndexOf("/", gt);
          if (-1 != slash && slash < gt) {
            var str = lineText.substr(slash, gt - slash + 1);
            if (!str.match( /\/\s*\>/ )) // yep, that's the end of empty tag
              return l+1;
          }
        }
        l++;
      }
      found = true;
    }
    else {
      var slashPos = lineText.lastIndexOf("/", gtPos);
      if (-1 == slashPos) { // cannot be empty tag
        found = true;
        // don't continue
      }
      else { // empty tag?
        // check if really empty tag
        var str = lineText.substr(slashPos, gtPos - slashPos + 1);
        if (!str.match( /\/\s*\>/ )) { // finally not empty
          found = true;
          // don't continue
        }
      }
    }
    if (found) {
      var subLine = lineText.substr(pos + 1);
      tag = subLine.match(xmlNAMERegExp);
      if (tag) {
        // we have an element name, wooohooo !
        tag = tag[0];
        // do we have the close tag on same line ???
        if (-1 != lineText.indexOf("</" + tag + ">", pos)) // yep
        {
          found = false;
        }
        // we don't, so we have a candidate...
      }
      else
        found = false;
    }
    if (!found)
      pos++;
  }

  if (found) {
    var startTag = "(\\<\\/" + tag + "\\>)|(\\<" + tag + "\\>)|(\\<" + tag + "\s)|(\\<" + tag + "$)";
    var startTagRegExp = new RegExp(startTag, "g");
    var endTag = "</" + tag + ">";
    var depth = 1;
    var l = line + 1;
    var lastLine = cm.lineCount();
    while (l < lastLine) {
      lineText = cm.getLine(l);
      var match = lineText.match(startTagRegExp);
      if (match) {
        for (var i = 0; i < match.length; i++) {
          if (match[i] == endTag)
            depth--;
          else
            depth++;
          if (!depth)
            return l+1;
        }
      }
      l++;
    }
    return;
  }
};


CodeMirror.newFoldFunction = function(rangeFinder, markText) {
  var folded = [];

  function isFolded(cm, n) {
    var info = cm.lineInfo(n);
    return (info.markerClass
            && -1 != info.markerClass.split(" ").indexOf("folded"));
  }

  function expandTo(cm, line, end) {
    for (var i = line; i < end; ++i)
      cm.showLine(i);
  }

  function expand(cm, line) {
    var info = cm.lineInfo(line);
    var markers = info.markerClass.split(" ");
    var hiddenEnd = -1;
    // remove the folded class
    markers.splice(markers.indexOf("folded"), 1);
    for (var i = 0; i < markers.length; i++)
      if (markers[i].substr(0, 7) == "hidden_") {
        hiddenEnd = parseInt(markers[i].substr(7));
        markers.splice(i, 1);
        break;
      }
    expandTo(cm, line, hiddenEnd);
    cm.setMarker(line, null, markers.join(" "));
  }

  return function(cm, line) {
    cm.operation(function() {
      var folded = isFolded(cm, line);
      if (folded) {
        expand(cm, line);
      } else {
        var end = rangeFinder(cm, line);
        if (end == null) return;
        var hidden = [];
        for (var i = line + 1; i < end; ++i) {
          var handle = cm.hideLine(i);
          if (handle) hidden.push(handle);
        }
        var info = cm.lineInfo(line);
        var markers = info.markerClass ? info.markerClass + " " : "";
        var first = cm.setMarker(line, null, markers + "folded hidden_" + end);
        cm.onDeleteLine(first, function() { expandTo(cm, line, end); });
      }
    });
  };
};
