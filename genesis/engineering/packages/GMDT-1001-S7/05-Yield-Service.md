# 05 Yield Service

Service: manufacturing.service.yield

Formula version: v1.good-over-processed

Computation:
- Numerator: good/completed quantity.
- Denominator: completed + rejected + scrap.
- Classification UNDEFINED when denominator is zero.
- Classification DEFINED with rounded ratio when denominator is positive.