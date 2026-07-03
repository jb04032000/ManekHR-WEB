export class Money {
  private readonly paise: number;

  private constructor(paise: number) {
    this.paise = Math.round(paise);
  }

  static fromRupees(rupees: number): Money {
    return new Money(rupees * 100);
  }

  static fromPaise(paise: number): Money {
    return new Money(paise);
  }

  static zero(): Money {
    return new Money(0);
  }

  add(other: Money): Money {
    return new Money(this.paise + other.paise);
  }

  subtract(other: Money): Money {
    return new Money(this.paise - other.paise);
  }

  multiply(factor: number): Money {
    return new Money(this.paise * factor);
  }

  percentage(percent: number): Money {
    return new Money((this.paise * percent) / 100);
  }

  clampZero(): Money {
    return new Money(Math.max(0, this.paise));
  }

  abs(): Money {
    return new Money(Math.abs(this.paise));
  }

  prorate(present: number, total: number): Money {
    if (total <= 0) {
      return Money.zero();
    }
    return new Money((this.paise * present) / total);
  }

  isZero(): boolean {
    return this.paise === 0;
  }

  isPositive(): boolean {
    return this.paise > 0;
  }

  isNegative(): boolean {
    return this.paise < 0;
  }

  isGreaterThan(other: Money): boolean {
    return this.paise > other.paise;
  }

  isGreaterThanOrEqual(other: Money): boolean {
    return this.paise >= other.paise;
  }

  isLessThan(other: Money): boolean {
    return this.paise < other.paise;
  }

  isEqual(other: Money): boolean {
    return this.paise === other.paise;
  }

  toRupees(): number {
    return this.paise / 100;
  }

  toPaise(): number {
    return this.paise;
  }

  format(symbol = '₹', locale = 'en-IN'): string {
    return `${symbol}${this.toRupees().toLocaleString(locale, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })}`;
  }

  formatCompact(symbol = '₹', locale = 'en-IN'): string {
    const rupees = this.toRupees();
    if (rupees >= 100000) {
      return `${symbol}${(rupees / 100000).toFixed(1)}L`;
    }
    if (rupees >= 1000) {
      return `${symbol}${(rupees / 1000).toFixed(1)}K`;
    }
    return `${symbol}${Math.round(rupees).toLocaleString(locale)}`;
  }
}
