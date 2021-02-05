// #package glsl/shaders

// #include ../mixins/unproject.glsl
// #include ../mixins/intersectCube.glsl

// #section FCNGenerate/vertex

void main() {}

// #section FCNGenerate/fragment

void main() {}

// #section FCNIntegrate/vertex

#version 300 es
precision mediump float;
uniform vec3 uSize;

layout(location = 0) in vec2 aPosition;
out vec2 vPosition;

void main() {
//    vPosition.x = (aPosition.x + 1.0) * 0.5 * uSize.x;
//    vPosition.y =  (aPosition.x + 1.0) * 0.5 * uSize.y;
    vPosition = (aPosition + 1.0) * 0.5;
    gl_Position = vec4(aPosition, 0.0, 1.0);
}

// #section FCNIntegrate/fragment

#version 300 es
#define DIRECTIONAL 0.5
precision mediump float;

uniform mediump sampler3D uEnergyDensity;
uniform mediump sampler3D uDiffusion;
uniform mediump sampler3D uVolume;
uniform mediump sampler2D uTransferFunction;

uniform vec3 uStep;
uniform vec3 uSize;
//uniform vec3 uLight;
uniform float uAbsorptionCoefficient;
uniform int uNLights;
uniform float uRatio;
uniform float uLayer;
uniform float uScattering;
uniform vec4 uLights[4];

in vec2 vPosition;

layout (location = 0) out vec4 oEnergyDensity;
layout (location = 1) out vec4 oDiffusion;

float convection(in float radiance, in float revAbsorption, in vec3 light,
                in float left, in float right, in float down, in float up, in float back, in float forward) {

    float newRadiance = 0.0;

    light = normalize(light);

    vec3 grad = vec3(
        light.x < 0.0 ? right - radiance : radiance - left,
        light.y < 0.0 ? up - radiance : radiance - down,
        light.z < 0.0 ? forward - radiance : radiance - back
    );
    // (1 - absorption) * (p - 1/2 deltap)
    float convectionDelta = -dot(light, grad) * 0.5 / uRatio;

    newRadiance = revAbsorption * (radiance + convectionDelta);
    return newRadiance;
}

float convectionPL(in float radiance, in float revAbsorption, in vec3 light, in vec3 position,
in float left, in float right, in float down, in float up, in float back, in float forward) {

    float newRadiance = 0.0;

    light = normalize(position - light);

    vec3 grad = vec3(
        light.x < 0.0 ? right - radiance : radiance - left,
        light.y < 0.0 ? up - radiance : radiance - down,
        light.z < 0.0 ? forward - radiance : radiance - back
    );
    // (1 - absorption) * (p - 1/2 deltap)
    float convectionDelta = -dot(light, grad) * 0.5 / uRatio;

    newRadiance = revAbsorption * (radiance + convectionDelta);
    return newRadiance;
}


float componentSum(in vec4 vector) {
    return vector.r + vector.g + vector.b + vector.a;
}

void main() {
    vec3 position = vec3(vPosition, uLayer);
    vec4 radiance = texture(uEnergyDensity, position);
    if (position.x <= uStep.x || position.y <= uStep.y || position.z < uStep.z ||
    position.x >= 1.0 - uStep.x || position.y >= 1.0 - uStep.y || position.z >=  1.0 - uStep.z) {
        oEnergyDensity = vec4(radiance);
        oDiffusion = vec4(0, 0, 0, 0);
        return;
    }

    float val = texture(uVolume, position).r;
    vec4 colorSample = texture(uTransferFunction, vec2(val, 0.5));
    float absorption = colorSample.a * uAbsorptionCoefficient;
    float revAbsorption = float(1) - absorption;
//    float newRadiance = 0.0;

    vec4 left      = texture(uEnergyDensity, position + vec3(-uStep.x,  0,  0));
    vec4 right     = texture(uEnergyDensity, position + vec3( uStep.x,  0,  0));
    vec4 down      = texture(uEnergyDensity, position + vec3( 0, -uStep.y,  0));
    vec4 up        = texture(uEnergyDensity, position + vec3( 0,  uStep.y,  0));
    vec4 back      = texture(uEnergyDensity, position + vec3( 0,  0, -uStep.z));
    vec4 forward   = texture(uEnergyDensity, position + vec3( 0,  0,  uStep.z));

    vec4 newRadiance = vec4(0);
//    newRadiance[0] = convection(radiance.r, revAbsorption, left.r, right.r, down.r, up.r, back.r, forward.r);

    for (int i = 0; i < uNLights; i++) {
        if (uLights[i].a < DIRECTIONAL) {
            newRadiance[i] = convection(radiance[i], revAbsorption, uLights[i].xyz,
                left[i], right[i], down[i], up[i], back[i], forward[i]);
        } else if (distance(position * uSize, uLights[i].xyz * uSize) <= 2.0) {
            newRadiance[i] = radiance[i];
        } else {
            newRadiance[i] = convectionPL(radiance[i], revAbsorption, uLights[i].xyz, position,
                left[i], right[i], down[i], up[i], back[i], forward[i]);
        }
    }

    oEnergyDensity = vec4(newRadiance);

//    oEnergyDensity = vec4(radiance, 0, 0, 0);

    float total_radiance = componentSum(radiance) + texture(uDiffusion, position).r;

    float total_left    = componentSum(left) + texture(uDiffusion, position + vec3(-uStep.x,  0,  0)).r;
    float total_right   = componentSum(right) + texture(uDiffusion, position + vec3(uStep.x,  0,  0)).r;
    float total_down    = componentSum(down) + texture(uDiffusion, position + vec3( 0, -uStep.y,  0)).r;
    float total_up      = componentSum(up) + texture(uDiffusion, position + vec3( 0,  uStep.y,  0)).r;
    float total_back    = componentSum(back) + texture(uDiffusion, position + vec3( 0, 0, -uStep.z)).r;
    float total_forward = componentSum(forward) + texture(uDiffusion, position + vec3( 0,  0, uStep.z)).r;

    float laplace = total_left + total_right + total_down + total_up + total_back + total_forward - 6.0 * total_radiance;

    float delta = laplace * total_radiance * uScattering / uRatio;
    oDiffusion = vec4(delta, 0, 0, 0);

//    oDiffusion = vec4(0, 0, 0, 0);
}

// #section FCNRender/vertex

#version 300 es
precision mediump float;

uniform mat4 uMvpInverseMatrix;

layout(location = 0) in vec2 aPosition;
out vec3 vRayFrom;
out vec3 vRayTo;

out vec2 vPosition;

@unproject

void main() {
    unproject(aPosition, uMvpInverseMatrix, vRayFrom, vRayTo);
    gl_Position = vec4(aPosition, 0.0, 1.0);
    //debug
    vPosition = aPosition * 0.5 + 0.5;
}

// #section FCNRender/fragment

#version 300 es
precision mediump float;

uniform mediump sampler3D uVolume;
uniform mediump sampler2D uTransferFunction;
uniform mediump sampler3D uEnergyDensity;
uniform mediump sampler3D uDiffusion;
uniform float uStepSize;
uniform float uOffset;
uniform float uAlphaCorrection;

in vec3 vRayFrom;
in vec3 vRayTo;
out vec4 oColor;

//debug
in vec2 vPosition;

@intersectCube

float componentSum(in vec4 vector) {
    return vector.r + vector.g + vector.b + vector.a;
}

void main() {

    vec3 rayDirection = vRayTo - vRayFrom;
    vec2 tbounds = max(intersectCube(vRayFrom, rayDirection), 0.0);
    if (tbounds.x >= tbounds.y) {
        oColor = vec4(1.0, 1.0, 1.0, 1.0);
    } else {
        vec3 from = mix(vRayFrom, vRayTo, tbounds.x);
        vec3 to = mix(vRayFrom, vRayTo, tbounds.y);
        float rayStepLength = distance(from, to) * uStepSize;

        float t = 0.0;
        vec3 pos;
        float val;
        vec4 colorSample;
        vec4 accumulator = vec4(0.0);

        float energyDensity;

        while (t < 1.0 && accumulator.a < 0.99) {
            pos = mix(from, to, t);
            val = texture(uVolume, pos).r;

            energyDensity = componentSum(texture(uEnergyDensity, pos));
//            energyDensity = texture(uEnergyDensity, pos).a;
            energyDensity += texture(uDiffusion, pos).r;

            colorSample = texture(uTransferFunction, vec2(val, 0.5));
            colorSample.a *= rayStepLength * uAlphaCorrection;
            // utezi z energy density
            colorSample.rgb *= colorSample.a * energyDensity;
            //            colorSample.rgb *= colorSample.a;
//                        colorSample.rgb = vec3(energyDensity);
            accumulator += (1.0 - accumulator.a) * colorSample;
            t += uStepSize;
        }

        if (accumulator.a > 1.0) {
            accumulator.rgb /= accumulator.a;
        }

//        oColor = vec4(accumulator.rgb, 1.0);
        oColor = mix(vec4(1), vec4(accumulator.rgb, 1), accumulator.a);
    }
}

// #section FCNReset/vertex

#version 300 es
precision mediump float;

layout(location = 0) in vec2 aPosition;

void main() {
    gl_Position = vec4(aPosition, 0.0, 1.0);
}

// #section FCNReset/fragment

#version 300 es
precision mediump float;

out vec4 oColor;

void main() {
    oColor = vec4(0.0, 0.0, 0.0, 1.0);
}

// #section FCNResetLightTexture/vertex

#version 300 es
precision mediump float;

layout(location = 0) in vec2 aPosition;
out vec2 vPosition;

void main() {
    vPosition = (aPosition + 1.0) * 0.5;
    gl_Position = vec4(aPosition, 0.0, 1.0);
}

// #section FCNResetLightTexture/fragment

#version 300 es
precision mediump float;
#define DIRECTIONAL 0.5
#define POINT 1.5

in vec2 vPosition;
uniform mediump sampler3D uEnergyDensity;
uniform mediump sampler3D uDiffusion;

uniform int uNLights;
uniform float uLayer;
uniform vec3 uStep;
uniform vec3 uSize;
uniform vec4 uLights[4];

layout (location = 0) out vec4 oEnergyDensity;
layout (location = 1) out vec4 oDiffusion;

bool lightOutsideVolume(vec3 position) {
    if (any(greaterThan(position, vec3(1.0))) || any(lessThan(position, vec3(0.0)))) {
        return true;
    }
    return false;
}

void main() {
    vec3 position = vec3(vPosition, uLayer);
    vec4 energyDensity = vec4(0.0);
    oDiffusion = vec4(0.0);
    int location = 0;
    if (position.x <= uStep.x) {
        location = 1;
    } else if (position.x >= 1.0 - uStep.x) {
        location = 2;
    } else if (position.y <= uStep.y) {
        location = 3;
    } else if (position.y >= 1.0 - uStep.y) {
        location = 4;
    } else if (position.z <= uStep.z) {
        location = 5;
    } else if (position.z >=  1.0 - uStep.z) {
        location = 6;
    }
    for (int i = 0; i < uNLights; i++) {
        if (uLights[i].a < DIRECTIONAL) {
            if (location == 1 && uLights[i].x > 0.0 ||
            location == 2 && uLights[i].x < 0.0 ||
            location == 3 && uLights[i].y > 0.0 ||
            location == 4 && uLights[i].y < 0.0 ||
            location == 5 && uLights[i].z > 0.0 ||
            location == 6 && uLights[i].z < 0.0) {
                energyDensity[i] = 1.0;
            }
        }
        else {
            if (lightOutsideVolume(vec3(uLights[i]))) {
                if (location == 1 && position.x - uLights[i].x > 0.0 ||
                location == 2 && position.x - uLights[i].x < 0.0 ||
                location == 3 && position.y - uLights[i].y > 0.0 ||
                location == 4 && position.y - uLights[i].y < 0.0 ||
                location == 5 && position.z - uLights[i].z > 0.0 ||
                location == 6 && position.z - uLights[i].z < 0.0) {
                    energyDensity[i] = 1.0;
                }
            } else if (distance(position * uSize, uLights[i].xyz * uSize) <= 2.0) {
                energyDensity[i] = 1.0;
            }
        }
    }
    oEnergyDensity = energyDensity;
}