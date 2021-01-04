package it.unibo.scafi.compiler.cache

import org.scalajs.linker.interface.Linker
/* from https://github.com/scalafiddle/scalafiddle-core */
object LinkerCache extends LRUCache[Linker]("Linker") {}
