/*
 * libpannellum - An WebGL based Panorama Renderer
 * Copyright (c) 2012-2013 Matthew Petroff
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

window.libpannellum = (function(window, document, undefined) {
function Renderer(canvas, image) {
    this.canvas = canvas;
    this.image = image;
    
    var program, gl;
    
    this.init = function(haov, vaov, voffset) {
        // Enable WebGL on canvas
        gl = this.canvas.getContext('experimental-webgl');
        
        // Create viewport for entire canvas and clear canvas
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);	
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        
        // Create vertex shader
        var vs = gl.createShader(gl.VERTEX_SHADER);
        gl.shaderSource(vs, v);
        gl.compileShader(vs);
        
        // Create fragment shader
        var fs = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(fs, f);
        gl.compileShader(fs);
        
        // Link WebGL program
        program = gl.createProgram();
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);
        
        // Log errors
        if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) 
            console.log(gl.getShaderInfoLog(vs));
        if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS))
            console.log(gl.getShaderInfoLog(fs));
        if (!gl.getProgramParameter(program, gl.LINK_STATUS))
            console.log(gl.getProgramInfoLog(program));
        
        // Use WebGL program
        gl.useProgram(program);
        
        // Look up texture coordinates location
        program.texCoordLocation = gl.getAttribLocation(program, 'a_texCoord');
        
        // Provide texture coordinates for rectangle
        program.texCoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, program.texCoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,1,1,1,1,-1,-1,1,1,-1,-1,-1]), gl.STATIC_DRAW);
        gl.enableVertexAttribArray(program.texCoordLocation);
        gl.vertexAttribPointer(program.texCoordLocation, 2, gl.FLOAT, false, 0, 0);
        
        // Pass aspect ratio
        program.aspectRatio = gl.getUniformLocation(program, 'u_aspectRatio');
        gl.uniform1f(program.aspectRatio, this.canvas.width / this.canvas.height);
        
        // Locate psi, theta, focal length, horizontal extent, vertical extent, and vertical offset
        program.psi = gl.getUniformLocation(program, 'u_psi');
        program.theta = gl.getUniformLocation(program, 'u_theta');
        program.f = gl.getUniformLocation(program, 'u_f');
        program.h = gl.getUniformLocation(program, 'u_h');
        program.v = gl.getUniformLocation(program, 'u_v');
        program.vo = gl.getUniformLocation(program, 'u_vo');
        
        // Pass horizontal extent, vertical extent, and vertical offset
        gl.uniform1f(program.h, haov / (Math.PI * 2.0));
        gl.uniform1f(program.v, vaov / Math.PI);
        gl.uniform1f(program.vo, voffset / Math.PI);
        
        // Create texture
        program.texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, program.texture);
        
        // Set parameters for rendering any size
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        
        // Upload image to texture
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.image);
    }
    
    this.render = function(pitch, yaw, hfov) {
        // Calculate focal length from horizontal angle of view
        var focal = 1 / Math.tan(hfov / 2);
        
        // Pass psi, theta, and focal length
        gl.uniform1f(program.psi, yaw);
        gl.uniform1f(program.theta, pitch);
        gl.uniform1f(program.f, focal);
        
        // Draw using current buffer
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    
    this.setImage = function(image) {
        this.image = image;
        this.init();
    }
    
    this.setCanvas = function(canvas) {
        this.canvas = canvas;
        this.init();
    }
}

// Vertex shader
var v = [
'attribute vec2 a_texCoord;',
'varying vec2 v_texCoord;',

'void main() {',
    // Set position
    'gl_Position = vec4(a_texCoord, 0.0, 1.0);',
    
    // Pass the coordinates to the fragment shader
    'v_texCoord = a_texCoord;',
'}'
].join('');

// Fragment shader
var f = [
'precision mediump float;',

'uniform float u_aspectRatio;',
'uniform float u_psi;',
'uniform float u_theta;',
'uniform float u_f;',
'uniform float u_h;',
'uniform float u_v;',
'uniform float u_vo;',

'const float PI = 3.14159265358979323846264;',

// Texture
'uniform sampler2D u_image;',

// Coordinates passed in from vertex shader
'varying vec2 v_texCoord;',

'void main() {',
    // Map canvas/camera to sphere
    'float x = v_texCoord.x * u_aspectRatio;',
    'float y = v_texCoord.y;',
    'float sintheta = sin(u_theta);',
    'float costheta = cos(u_theta);',
    'float a = u_f * costheta - y * sintheta;',
    'float root = sqrt(x * x + a * a);',
    'float lambda = atan(x / root, a / root) + u_psi;',
    'float phi = atan((y * costheta + u_f * sintheta) / root);',
    
    // Wrap image
    'if(lambda > PI)',
        'lambda = lambda - PI * 2.0;',
    'if(lambda < -PI)',
       'lambda = lambda + PI * 2.0;',
    
    // Map texture to sphere
    'vec2 coord = vec2(lambda / PI, phi / (PI / 2.0));',
    
    // Look up color from texture
    // Map from [-1,1] to [0,1] and flip y-axis
    'if(coord.x < -u_h || coord.x > u_h || coord.y < -u_v + u_vo || coord.y > u_v + u_vo)',
        'gl_FragColor = vec4(0, 0, 0, 1.0);',
    'else',
        'gl_FragColor = texture2D(u_image, vec2((coord.x + u_h) / (u_h * 2.0), (-coord.y + u_v + u_vo) / (u_v * 2.0)));',
'}'
].join('\n');

return {
    renderer: function(canvas, image) {
        return new Renderer(canvas, image);
    }
}

})(window, document);
