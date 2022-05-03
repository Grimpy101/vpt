// #part /glsl/mixins/btrand

float btrand(inout vec4 n) {
    const vec4 q = vec4(   1225.0,    1585.0,    2457.0,    2098.0);
    const vec4 r = vec4(   1112.0,     367.0,      92.0,     265.0);
    const vec4 a = vec4(   3423.0,    2646.0,    1707.0,    1999.0);
    const vec4 m = vec4(4194287.0, 4194277.0, 4194191.0, 4194167.0);

    vec4 beta = floor(n / q);
    vec4 p = a * (n - beta * q) - beta * r;
    beta = (sign(-p) + vec4(1.0)) * vec4(0.5) * m;
    n = (p + beta);

    return fract(dot(n / m, vec4(1.0, -1.0, 1.0, -1.0)));
}
