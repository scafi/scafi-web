package it.unibo.scafi.js.utils

case class Tree[K, D](key : K, data : D, children : Seq[Tree[K, D]]) {
  def map[E, C](fun : (K, D) => (E, C)) : Tree[E, C] = {
    val (mapK, mapV) = fun(key, data)
    Tree(mapK, mapV, children.map(tree => tree.map(fun)))
  }
}
object Tree {
  def fromMap[K, D](root : (K, D), map : Map[K, Iterable[(K, D)]]) : Tree[K, D] = {
    val children = map.get(root._1) match {
      case None => Seq.empty
      case Some(children) => children.map(child => fromMap(child, map)).toSeq
    }
    Tree(root._1, root._2, children)
  }
}
