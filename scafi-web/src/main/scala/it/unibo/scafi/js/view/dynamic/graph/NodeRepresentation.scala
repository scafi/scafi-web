package it.unibo.scafi.js.view.dynamic.graph

import it.unibo.scafi.js.facade.phaser.namespaces.GameObjectsNamespace.GameObject
import it.unibo.scafi.js.facade.phaser.namespaces.gameobjects.ComponentsNamespace.{ComputedSize, Transform}

object NodeRepresentation {
  type GameobjectNode = GameObject with Transform with ComputedSize

  implicit class WithId[E <: GameObject](gameObject: E) {
    def id : String = gameObject.getData("id").toString
    def id_=(id : String) : GameObject = gameObject.setData("id", id)
  }
}
