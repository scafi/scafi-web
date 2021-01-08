package it.unibo.scafi.compiler.cache

trait CodeCache {
  def put(id : String, code : String) : CodeCache
  def get(id : String) : Option[String]
  def hit(id : String) : Boolean
}

object CodeCache {
  def limit(elements : Int) : CodeCache = CodeCacheLimited(elements, Seq.empty)

  case class CodeCacheLimited(elements : Int, codeSeq : Seq[(String, String)]) extends CodeCache {
    override def put(id: String, code: String): CodeCache = if (codeSeq.size >= elements) {
      CodeCacheLimited(elements, codeSeq.tail :+ (id -> code))
    } else {
      CodeCacheLimited(elements, codeSeq :+ (id -> code))
    }

    override def get(id: String): Option[String] = codeSeq.find(_._1 == id).map(_._2)

    override def hit(id: String): Boolean = codeSeq.exists(_._1 == id)
  }
}