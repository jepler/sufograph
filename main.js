/*
    Copyright © 2017 Jeff Epler <jepler@unpythonic.net>

    This program is free software; you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation; either version 2 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License along
    with this program; if not, write to the Free Software Foundation, Inc.,
    51 Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA.
*/
var fix = function(d) { return d.toFixed(2); }
var todatauri = function(d, t) { return "data:" + (t || "") + ";base64," + btoa(d); }

var Curve = function(a, b, m, n1, n2, n3, scale)  {
    this.a = a;
    this.b = b;
    this.m = m;
    this.n1 = n1;
    this.n2 = n2;
    this.n3 = n3;
    this.scale = scale || 1;
}
Curve.prototype.r = function(phi) {
    return this.scale * Math.pow(
        Math.pow( Math.abs( Math.cos(this.m * phi / 4) / this.a), this.n2 ) +
        Math.pow( Math.abs( Math.sin(this.m * phi / 4) / this.b), this.n3 ),
            -1/this.n1)
}

Curve.prototype.max_phi = function() {
    return 2 * Math.PI
    // the period of the curve is only 2pi when n2==n3
    // otherwise, it's 4.  when n2*n3 > 0, the path joins up at 2pi
    // but with a curvature discontinuity at the join.
    // should make it optional to draw the full 4pi curve, I don't want
    // to ruin old spiral and rosette-with-stem drawings
    if(this.n2 == this.n3) return 2 * Math.PI
    return 4 * Math.PI
}

Curve.prototype.xy = function(phi) {
    var r = this.r(phi);
    return [r * Math.cos(phi), r * Math.sin(phi)]
}

Curve.prototype.dxy = function(phi, h) {
    h = h || 1e-9
    var xy0 = this.xy(phi-h);
    var xy1 = this.xy(phi+h);
    return [(xy1[0]-xy0[0]) / (2*h), (xy1[1]-xy0[1]) / (2*h)]
}

Curve.prototype.pathcommand = function() {
    var r = arguments[0]
    for(var i = 1; i < arguments.length; i++) {
        if(i > 1) r = r + ","
        r = r + arguments[i].toFixed(2)
    }
    return r;
}

Curve.prototype.svgpath = function(n) {
    n = n || 32
    var r = ""
    var ox, oy, odx, ody;
    var dphi = 2 * Math.PI / n
    var dmul = .4 * dphi // empirical
    for(var i=0; i<=n; i++) {
        var xy = this.xy(i * this.max_phi() / n);
        var x = xy[0], y = xy[1];
        var dxy = this.dxy(i * this.max_phi() / n);
        var dx = (dmul*dxy[0]), dy = (dmul*dxy[1])
        if(i == 0) {
            r = r + this.pathcommand("M", x, y)
        } else if(i == 1) {
            r = r + this.pathcommand("c", odx, ody, x-dx-ox, y-dy-oy, x-ox, y-oy)
        } else {
            r = r + this.pathcommand("s", x-dx-ox, y-dy-oy, x-ox, y-oy)
        }
        odx = dx; ody = dy
        ox = x; oy = y
    }
    return r
}

Curve.prototype.bbox = function(n) {
    n = n || 32
    var x0 = 0, y0 = 0, x1 = 0, y1 = 0
    for(var i=0; i<n; i++) {
        var xy = this.xy(i * this.max_phi() / n);
        var x = xy[0], y = xy[1]
        if(x < x0) x0 = x
        if(x > x1) x1 = x
        if(y < y0) y0 = y
        if(y > y1) y1 = y
    }
    return [x0, y0, x1, y1]
}

Curve.prototype.maxr = function(n) {
    n = n || 32
    var mr = 0
    for(var i=0; i<n; i++) {
        var r = this.r(i * this.max_phi() / n);
        if(r > mr) mr = r
    }
    return mr
}

Curve.prototype.tosvg = function(n, props) {
    var path = this.svgpath(n);
    var bbox = this.bbox()
    return (
        "<svg width=\"1024\" height=\"600\" viewbox=\"" + fix(bbox[0]) + " " + fix(bbox[1]) + " " + fix(bbox[2] - bbox[0]) + " " + fix(bbox[3] - bbox[1]) + "\"\n"
        + "xmlns=\"http://www.w3.org/2000/svg\" version=\"1.1\"\n"
        + "xmlns:xlink=\"http://www.w3.org/1999/xlink\">"
        + "<path d=\"" + path + "\" " + (props || "") + "/>"
        + "</svg>")
}

Curve.prototype.tosvgdatauri = function(n, props) {
    var svg = this.tosvg(n, props)
    return todatauri(svg, "image/svg+xml")
}

Curve.prototype.preppathlen = function(n) {
    n = n || 512
    this.cl = [0];
    var l = 0;
    var oxy = this.xy(0)
    for(var i=1; i<=n; i++) {
        var phi = i * this.max_phi() / n;
        var xy = this.xy(phi)
        this.cl.push(l += Math.hypot(xy[0] - oxy[0], xy[1] - oxy[1]))
        oxy = xy
    }
    if(l)
        for(var i=1; i<=n; i++) {
            this.cl[i] /= l
        }
    this.ol = 0
    this.oi = 0
}

Curve.prototype.xypathlen = function(l) {
    this.cl || this.preppathlen()
    if(l < this.ol) { this.oi = 0 }
    this.ol = l
    while(l > this.cl[this.oi]) this.oi++;
    var dlen = this.cl[this.oi + 1] - this.cl[this.oi];
    var dt = l - this.cl[this.oi];
    var dphi = this.max_phi() / (this.cl.length - 1)
    var phi = dphi * (this.oi + dt/dlen)
    return this.xy(phi)
}
