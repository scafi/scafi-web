package it.unibo.scafi.js

import scala.scalajs.js

package object dsl {
  type Metric = JF0[Double]
  type JF0[+O] = js.Function0[O]
  type JF1[-I, +O] = js.Function1[I, O]
  type JF2[-I1, -I2, +O] = js.Function2[I1, I2, O]
  type JF3[-I1, -I2, -I3, +O] = js.Function3[I1, I2, I3, O]
}
