package it.unibo.scafi.compiler.cache

import scala.tools.nsc

/* from https://github.com/scalafiddle/scalafiddle-core */
object AutoCompleteCache extends LRUCache[nsc.interactive.Global]("AutoComplete") {}
