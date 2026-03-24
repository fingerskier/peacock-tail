# peacock
A log tail visualizer 

* give it a file to watch
  * `npx peacock server.log`
* on each iteration it produces a data structure containing trends and notable key-values & a markdown summary
  * subsequent updates receive the prior iterate's data/summary and a tail of the log
  * this is fed into something like `claude -p ...` to get the next result
* it serves a simple localhost, single-page web-server
  * chart.js and/or d3 for viz
  * md -> html for summary
