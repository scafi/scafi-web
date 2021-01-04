package it.unibo.scafi.compiler.cache

import scala.tools.nsc
/* from https://github.com/scalafiddle/scalafiddle-core */
object CompilerCache extends LRUCache[nsc.Global]("Compiler") {}
