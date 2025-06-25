import BigNumber from 'bignumber.js'

export type BigValue = number | BigNumber | BigDecimal

export class BigDecimal extends BigNumber {
  constructor(value: BigValue) {
    super(value)
  }

  public add(value: BigValue) {
    return new BigDecimal(this.plus(value))
  }

  public subtract(value: BigValue) {
    return new BigDecimal(this.minus(value))
  }

  public multiply(value: BigValue) {
    return new BigDecimal(this.multipliedBy(value))
  }

  public divide(
    value: BigValue,
    scale?: number,
    roundingMode?: BigNumber.RoundingMode,
  ) {
    let bigNumber = this.dividedBy(value)

    if (scale !== undefined) {
      bigNumber = bigNumber.decimalPlaces(scale, roundingMode)
    }

    return new BigDecimal(bigNumber)
  }

  public compareTo(value: BigValue) {
    return new BigDecimal(this.comparedTo(value)!)
  }

  public setScale(scale: number, roundingMode?: BigNumber.RoundingMode) {
    return new BigDecimal(this.decimalPlaces(scale, roundingMode))
  }

  public static ONE() {
    return new BigDecimal(1)
  }

  public static ZERO() {
    return new BigDecimal(0)
  }

  public static valueOf(value: BigValue) {
    return new BigDecimal(value)
  }
}
