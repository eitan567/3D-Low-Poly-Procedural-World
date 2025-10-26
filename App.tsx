
import React, { useRef, useEffect, useState } from 'react';

// Define THREE on window to satisfy TypeScript since it's loaded via CDN
declare global {
    interface Window {
        THREE: any;
    }
}

// Create geometries and materials once to be reused by all instances
const { THREE } = window;

// --- Default Tree Geometries ---
const TRUNK_GEOMETRY = THREE ? new THREE.CylinderGeometry(0.8, 1.2, 6, 6) : null;
const LEAVES_GEOMETRY = THREE ? new THREE.ConeGeometry(3.5, 7, 6) : null;
if (THREE && TRUNK_GEOMETRY && LEAVES_GEOMETRY) {
    TRUNK_GEOMETRY.translate(0, 6 / 2, 0);
    LEAVES_GEOMETRY.translate(0, 6 + 7 / 2, 0);
}

// --- Pine Tree Geometries ---
const PINE_TRUNK_GEOMETRY = THREE ? new THREE.CylinderGeometry(0.6, 0.9, 8, 5) : null;
const PINE_LEAVES1_GEOMETRY = THREE ? new THREE.ConeGeometry(3, 5, 6) : null;
const PINE_LEAVES2_GEOMETRY = THREE ? new THREE.ConeGeometry(2.5, 5, 6) : null;
const PINE_LEAVES3_GEOMETRY = THREE ? new THREE.ConeGeometry(2, 5, 6) : null;
if (THREE && PINE_TRUNK_GEOMETRY && PINE_LEAVES1_GEOMETRY && PINE_LEAVES2_GEOMETRY && PINE_LEAVES3_GEOMETRY) {
    PINE_TRUNK_GEOMETRY.translate(0, 8 / 2, 0); // Base at y=0
    // Stack the leaf cones with some overlap for a fuller look
    PINE_LEAVES1_GEOMETRY.translate(0, 8.5, 0);
    PINE_LEAVES2_GEOMETRY.translate(0, 8.5 + 2, 0);
    PINE_LEAVES3_GEOMETRY.translate(0, 8.5 + 4, 0);
}

// --- Bush Geometry ---
let BUSH_GEOMETRY: any = null;
if (THREE && window.THREE.BufferGeometryUtils) {
    const puffGeom = new THREE.IcosahedronGeometry(1, 0);
    const geoms = [];
    for (let i = 0; i < 5; i++) {
        const puff = puffGeom.clone();
        const scale = 0.5 + Math.random() * 0.5;
        puff.scale(scale, scale, scale);
        puff.translate(
            (Math.random() - 0.5) * 1.5,
            (Math.random() - 0.5) * 0.5,
            (Math.random() - 0.5) * 1.5
        );
        geoms.push(puff);
    }
    BUSH_GEOMETRY = THREE.BufferGeometryUtils.mergeBufferGeometries(geoms, false);
    BUSH_GEOMETRY.translate(0, 0.5, 0); // Sit on ground
    puffGeom.dispose();
}

// --- Flower Geometries ---
const FLOWER_STEM_GEOMETRY = THREE ? new THREE.CylinderGeometry(0.05, 0.05, 0.5, 3) : null;
const FLOWER_HEAD_GEOMETRY = THREE ? new THREE.IcosahedronGeometry(0.2, 0) : null;
const FLOWER_LEAF_GEOMETRY = THREE ? new THREE.PlaneGeometry(0.2, 0.2) : null;
if (THREE && FLOWER_STEM_GEOMETRY && FLOWER_HEAD_GEOMETRY && FLOWER_LEAF_GEOMETRY) {
    FLOWER_STEM_GEOMETRY.translate(0, 0.25, 0);
    FLOWER_HEAD_GEOMETRY.translate(0, 0.55, 0);
    FLOWER_LEAF_GEOMETRY.rotateX(-Math.PI / 4);
    FLOWER_LEAF_GEOMETRY.translate(0.1, 0.25, 0);
}


// --- Fish Geometry ---
const FISH_GEOMETRY = THREE ? new THREE.BoxGeometry(1.2, 0.4, 0.3) : null;

// --- Cloud Geometry ---
let CLOUD_GEOMETRY: any = null;
if (THREE) {
    // A check to ensure BufferGeometryUtils is loaded before using it
    if (window.THREE.BufferGeometryUtils) {
        const basePuffGeometry = new THREE.IcosahedronGeometry(1, 0); // Use 0 subdivisions for a faceted, low-poly look.

        const geometriesToMerge = [];
        const puffCount = 5 + Math.floor(Math.random() * 5); // 5 to 9 puffs per cloud

        for (let i = 0; i < puffCount; i++) {
            const puff = basePuffGeometry.clone();
            
            // Apply random transformations
            const scale = 2.5 + Math.random() * 3;
            puff.scale(scale, scale, scale);

            puff.translate(
                (Math.random() - 0.5) * 12,
                (Math.random() - 0.5) * 4,
                (Math.random() - 0.5) * 8
            );
            
            geometriesToMerge.push(puff);
        }

        // Use the utility to merge, it correctly handles non-indexed geometries.
        CLOUD_GEOMETRY = THREE.BufferGeometryUtils.mergeBufferGeometries(geometriesToMerge, false);

        // Dispose of the base geometry as it's no longer needed for this composite shape.
        basePuffGeometry.dispose();

    } else {
        // Log an error if the utility script isn't available. The app will fail gracefully later.
        console.error("THREE.BufferGeometryUtils is not loaded. Please ensure the script is included in index.html.");
    }
}


// --- Wind Shader Logic ---
const windUniforms = {
    uTime: { value: 0 },
    uWindStrength: { value: 0.2 },
};

const createWindyMaterialCompiler = (height: number, swayFactor: number) => (shader: any) => {
    shader.uniforms.uTime = windUniforms.uTime;
    shader.uniforms.uWindStrength = windUniforms.uWindStrength;

    shader.vertexShader = 'uniform float uTime;\nuniform float uWindStrength;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
        vec4 windWorldPosition = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        float windIntensity = pow(max(0.0, position.y / ${height.toFixed(1)}), 2.0);
        float timeOffset = windWorldPosition.x + windWorldPosition.z;
        float sway = sin(uTime * 1.5 + timeOffset * 0.5) * windIntensity * uWindStrength * ${swayFactor.toFixed(2)};
        
        vec3 transformed = vec3(position);
        transformed.x += sway;
        transformed.z += sway * 0.5;
        `
    );
};

// Specialized wind shader for flower heads to make them follow the stem
const createFlowerHeadWindyMaterialCompiler = (swayPointY: number, height: number, swayFactor: number) => (shader: any) => {
    shader.uniforms.uTime = windUniforms.uTime;
    shader.uniforms.uWindStrength = windUniforms.uWindStrength;

    shader.vertexShader = 'uniform float uTime;\nuniform float uWindStrength;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
        vec4 windWorldPosition = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        // Use a fixed Y position to calculate wind intensity, so the whole head sways uniformly with the top of the stem.
        float windIntensity = pow(max(0.0, ${swayPointY.toFixed(1)} / ${height.toFixed(1)}), 2.0); 
        float timeOffset = windWorldPosition.x + windWorldPosition.z;
        float sway = sin(uTime * 1.5 + timeOffset * 0.5) * windIntensity * uWindStrength * ${swayFactor.toFixed(2)};
        
        vec3 transformed = vec3(position);
        transformed.x += sway;
        transformed.z += sway * 0.5;
        `
    );
};

// --- Materials ---
const TRUNK_MATERIAL = THREE ? new THREE.MeshLambertMaterial({
    emissive: 0x1a110a,
    emissiveIntensity: 0.2
}) : null;
if (TRUNK_MATERIAL) TRUNK_MATERIAL.onBeforeCompile = createWindyMaterialCompiler(8.0, 0.1);


const LEAVES_MATERIAL = THREE ? new THREE.MeshLambertMaterial({
    emissive: 0x112211,
    emissiveIntensity: 0.3
}) : null;
if (LEAVES_MATERIAL) LEAVES_MATERIAL.onBeforeCompile = createWindyMaterialCompiler(15.0, 1.0);


// Pine leaves are a slightly darker green
const PINE_LEAVES_MATERIAL = THREE ? new THREE.MeshLambertMaterial({
    emissive: 0x102010,
    emissiveIntensity: 0.25
}) : null;
if (PINE_LEAVES_MATERIAL) PINE_LEAVES_MATERIAL.onBeforeCompile = createWindyMaterialCompiler(15.0, 1.0);

const BUSH_MATERIAL = THREE ? new THREE.MeshLambertMaterial({
    emissive: 0x152515,
    emissiveIntensity: 0.2
}) : null;
if (BUSH_MATERIAL) BUSH_MATERIAL.onBeforeCompile = createWindyMaterialCompiler(2.0, 0.5);

const FLOWER_STEM_MATERIAL = THREE ? new THREE.MeshLambertMaterial({ color: 0x33691e }) : null;
if (FLOWER_STEM_MATERIAL) FLOWER_STEM_MATERIAL.onBeforeCompile = createWindyMaterialCompiler(0.5, 1.5);

const FLOWER_HEAD_MATERIAL = THREE ? new THREE.MeshLambertMaterial({ emissiveIntensity: 0.4 }) : null;
// Use the specialized compiler to make the head follow the stem's sway
if (FLOWER_HEAD_MATERIAL) FLOWER_HEAD_MATERIAL.onBeforeCompile = createFlowerHeadWindyMaterialCompiler(0.5, 0.5, 1.5);

const FLOWER_LEAF_MATERIAL = THREE ? new THREE.MeshLambertMaterial({ color: 0x4caf50, side: THREE.DoubleSide }) : null;
if (FLOWER_LEAF_MATERIAL) FLOWER_LEAF_MATERIAL.onBeforeCompile = createWindyMaterialCompiler(0.5, 2.0);


const FISH_MATERIAL = THREE ? new THREE.MeshLambertMaterial({ color: 0xffa500 }) : null;
const CLOUD_MATERIAL = THREE ? new THREE.MeshLambertMaterial({ 
    color: 0xffffff, 
    emissive: 0xeeeeff, 
    emissiveIntensity: 0.1,
    flatShading: true,
}) : null;


const App: React.FC = () => {
    const mountRef = useRef<HTMLDivElement>(null);
    const [fps, setFps] = useState(0);
    const [position, setPosition] = useState('0, 0, 0');
    const [chunkCount, setChunkCount] = useState(0);
    const [isMobile, setIsMobile] = useState(false);
    const [showControls, setShowControls] = useState(true);
    const [bloomParams, setBloomParams] = useState({
        threshold: 0.97,
        strength: 3.0,
        radius: 1.0,
    });
    const [cloudParams, setCloudParams] = useState({
        count: 1000,
        speed: 1.0,
    });
    const [ambientIntensity, setAmbientIntensity] = useState(0.6);
    const [groundParams, setGroundParams] = useState({
        scale: 6,
        showTexture: true,
    });
    const [windParams, setWindParams] = useState({
        strength: 0.2,
    });


    // Use refs for state that changes in the animation loop to avoid re-renders
    const mv = useRef({ forward: false, backward: false, left: false, right: false, up: false, down: false, boost: false });
    const look = useRef({ lat: 0, lon: 0 });
    const bloomPassRef = useRef<any>(null);
    const waterRef = useRef<any>(null);
    const fishDataRef = useRef<any[]>([]);
    const fishMeshRef = useRef<any>(null);
    const cloudMeshRef = useRef<any>(null);
    const cloudDataRef = useRef<any[]>([]);
    const cloudParamsRef = useRef(cloudParams);
    const windParamsRef = useRef(windParams);
    const ambientLightRef = useRef<any>(null);
    const groundTextureRef = useRef<any>(null);
    const terrainMaterialRef = useRef<any>(null);
    
    useEffect(() => {
        setIsMobile(window.innerWidth <= 768);
    }, []);

    // Effect to update bloom pass when params change
    useEffect(() => {
        if (bloomPassRef.current) {
            bloomPassRef.current.threshold = bloomParams.threshold;
            bloomPassRef.current.strength = bloomParams.strength;
            bloomPassRef.current.radius = bloomParams.radius;
        }
    }, [bloomParams]);

    // Effect to update ambient light intensity
    useEffect(() => {
        if (ambientLightRef.current) {
            ambientLightRef.current.intensity = ambientIntensity;
        }
    }, [ambientIntensity]);

    // Effect to update ground texture scale
    useEffect(() => {
        if (groundTextureRef.current) {
            groundTextureRef.current.repeat.set(groundParams.scale, groundParams.scale);
        }
    }, [groundParams.scale]);

    // Effect to update ground texture visibility
    useEffect(() => {
        if (terrainMaterialRef.current && groundTextureRef.current) {
            terrainMaterialRef.current.map = groundParams.showTexture ? groundTextureRef.current : null;
            terrainMaterialRef.current.needsUpdate = true;
        }
    }, [groundParams.showTexture]);
    
    // Effect to update cloud count when params change
    useEffect(() => {
        if (cloudMeshRef.current) {
           cloudMeshRef.current.count = cloudParams.count;
        }
        cloudParamsRef.current = cloudParams;
    }, [cloudParams]);
    
    // Effect to update wind params ref
    useEffect(() => {
        windParamsRef.current = windParams;
    }, [windParams]);


    useEffect(() => {
        if (!mountRef.current) return;
        const { THREE } = window;
        if (!THREE || !TRUNK_GEOMETRY || !LEAVES_GEOMETRY || !TRUNK_MATERIAL || !LEAVES_MATERIAL || !PINE_TRUNK_GEOMETRY || !PINE_LEAVES1_GEOMETRY || !PINE_LEAVES2_GEOMETRY || !PINE_LEAVES3_GEOMETRY || !PINE_LEAVES_MATERIAL || !FISH_GEOMETRY || !FISH_MATERIAL || !CLOUD_GEOMETRY || !CLOUD_MATERIAL || !BUSH_GEOMETRY || !BUSH_MATERIAL || !FLOWER_STEM_GEOMETRY || !FLOWER_HEAD_GEOMETRY || !FLOWER_STEM_MATERIAL || !FLOWER_HEAD_MATERIAL || !FLOWER_LEAF_GEOMETRY || !FLOWER_LEAF_MATERIAL) {
            console.error("Three.js not loaded or base geometries failed to initialize");
            return;
        }

        /* ---------------  Scene / Renderer  ----------------- */
        const scene = new THREE.Scene();
        scene.fog = new THREE.Fog(0x87CEEB, 200, 800);
        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
        camera.position.set(25, 15, 25);
        const renderer = new THREE.WebGLRenderer({
            antialias: true,
            logarithmicDepthBuffer: true
        });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.setClearColor(0x87CEEB); // A nice sky blue
        mountRef.current.appendChild(renderer.domElement);
        
        /* --------------- Post-processing ---------------- */
        const composer = new THREE.EffectComposer(renderer);
        const renderPass = new THREE.RenderPass(scene, camera);
        composer.addPass(renderPass);
        const bloomPass = new THREE.UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            bloomParams.strength,
            bloomParams.radius,
            bloomParams.threshold
        );
        bloomPassRef.current = bloomPass;
        composer.addPass(bloomPass);

        /* ---------------  Lights  ----------------- */
        const ambientLight = new THREE.AmbientLight(0xffffff, ambientIntensity); // Slightly brighter ambient
        ambientLightRef.current = ambientLight;
        scene.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.7);
        directionalLight.position.set(100, 200, 100);
        directionalLight.castShadow = true;
        directionalLight.shadow.camera.left = -200;
        directionalLight.shadow.camera.right = 200;
        directionalLight.shadow.camera.top = 200;
        directionalLight.shadow.camera.bottom = -200;
        directionalLight.shadow.camera.near = 0.1;
        directionalLight.shadow.camera.far = 500;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        scene.add(directionalLight);

        /* ---------------  Sun  ----------------- */
        const sun = new THREE.Mesh(
            new THREE.SphereGeometry(20, 16, 16),
            new THREE.MeshBasicMaterial({ color: 0xFFFF99 }) // A bright yellow to make it bloom
        );
        sun.position.copy(directionalLight.position);
        scene.add(sun);

        /* --------------- Geometric Clouds ----------------- */
        const CLOUD_COUNT = 1000;
        const cloudMesh = new THREE.InstancedMesh(CLOUD_GEOMETRY, CLOUD_MATERIAL, CLOUD_COUNT);
        const cloudData = [];
        const tempObject = new THREE.Object3D();
        const tempColor = new THREE.Color();
        const cloudAreaSize = 3000;
        
        for (let i = 0; i < CLOUD_COUNT; i++) {
            const x = (Math.random() - 0.5) * cloudAreaSize;
            const y = 90 + Math.random() * 50;
            const z = (Math.random() - 0.5) * cloudAreaSize;
            
            tempObject.position.set(x, y, z);
            tempObject.rotation.y = Math.random() * Math.PI * 2;
            tempObject.scale.setScalar(0.8 + Math.random() * 2.5); // Increased size diversity
            tempObject.updateMatrix();
            cloudMesh.setMatrixAt(i, tempObject.matrix);

            // Add color variation for depth
            const randomBrightness = 0.85 + Math.random() * 0.3;
            tempColor.setScalar(randomBrightness);
            cloudMesh.setColorAt(i, tempColor);

            cloudData.push({
                x, y, z,
                speed: 0.05 + Math.random() * 0.1,
                z_speed: (Math.random() - 0.5) * 0.05 // Add subtle z-axis drift
            });
        }
        if (cloudMesh.instanceColor) cloudMesh.instanceColor.needsUpdate = true; // Signal update
        cloudMesh.castShadow = true; // Subtle effect on ground
        scene.add(cloudMesh);
        cloudMeshRef.current = cloudMesh;
        cloudDataRef.current = cloudData;
        cloudMesh.count = cloudParams.count; // Set initial visible count
        
        /* ---------------  Realistic Water  ----------------- */
        const waterGeometry = new THREE.PlaneGeometry(10000, 10000);
        const waterNormals = new THREE.TextureLoader().load('https://threejs.org/examples/textures/waternormals.jpg', function (texture) {
            texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        });

        const water = new THREE.Water(
            waterGeometry,
            {
                textureWidth: 512,
                textureHeight: 512,
                waterNormals: waterNormals,
                sunDirection: directionalLight.position.clone().normalize(),
                sunColor: 0xffffff,
                waterColor: 0x36A2EB, // Brighter, more stylized blue
                distortionScale: 1.0,  // Less distortion for a calmer, clearer look
                fog: scene.fog !== undefined
            }
        );
        water.rotation.x = -Math.PI / 2;
        water.position.y = -1.0; // Lowered further to prevent z-fighting, combined with log depth buffer
        scene.add(water);
        waterRef.current = water;
        
        /* ---------------  Fish School  ----------------- */
        const FISH_COUNT = 50;
        const fishMesh = new THREE.InstancedMesh(FISH_GEOMETRY, FISH_MATERIAL, FISH_COUNT);
        const fishData = [];

        for (let i = 0; i < FISH_COUNT; i++) {
            const x = (Math.random() - 0.5) * 100;
            const y = (Math.random() - 0.8) * 5 - 2; // Keep them under the surface
            const z = (Math.random() - 0.5) * 100;
            
            tempObject.position.set(x, y, z);
            tempObject.updateMatrix();
            fishMesh.setMatrixAt(i, tempObject.matrix);
            
            fishData.push({
                position: new THREE.Vector3(x, y, z),
                velocity: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(0.1)
            });
        }
        scene.add(fishMesh);
        fishMeshRef.current = fishMesh;
        fishDataRef.current = fishData;


        /* ---------------  World  ----------------- */
        const CHUNK_SIZE = 50;
        const RENDER_DISTANCE = 4;
        const chunks = new Map(), vegetationChunks = new Map();
        const bottomCaps = new Map();

        // --- Terrain Material & Texture ---
        const terrainMaterial = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
        terrainMaterialRef.current = terrainMaterial;
        new THREE.TextureLoader().load('https://threejs.org/examples/textures/terrain/grasslight-big.jpg', (texture) => {
            texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
            groundTextureRef.current = texture; // Store ref for dynamic updates
            if (groundParams.showTexture) {
                terrainMaterial.map = texture;
            }
            terrainMaterial.needsUpdate = true;
            // Set initial scale from state
            texture.repeat.set(groundParams.scale, groundParams.scale);
        });

        // --- Perlin Noise Implementation ---
        const perlin = (() => {
            const p = new Uint8Array(512);
            for (let i = 0; i < 256; i++) p[i] = i;
            
            // Shuffle p
            for (let i = 255; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [p[i], p[j]] = [p[j], p[i]];
            }
            for (let i = 0; i < 256; i++) p[i + 256] = p[i];

            const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
            const lerp = (t: number, a: number, b: number) => a + t * (b - a);
            const grad = (hash: number, x: number, y: number, z: number) => {
                const h = hash & 15;
                const u = h < 8 ? x : y;
                const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
                return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
            };

            return {
                noise: (x: number, y: number, z: number = 0) => {
                    const X = Math.floor(x) & 255;
                    const Y = Math.floor(y) & 255;
                    const Z = Math.floor(z) & 255;
                    x -= Math.floor(x);
                    y -= Math.floor(y);
                    z -= Math.floor(z);
                    const u = fade(x);
                    const v = fade(y);
                    const w = fade(z);
                    const A = p[X] + Y, AA = p[A] + Z, AB = p[A + 1] + Z;
                    const B = p[X + 1] + Y, BA = p[B] + Z, BB = p[B + 1] + Z;

                    return lerp(w, lerp(v, lerp(u, grad(p[AA], x, y, z),
                                                grad(p[BA], x - 1, y, z)),
                                        lerp(u, grad(p[AB], x, y - 1, z),
                                                grad(p[BB], x - 1, y - 1, z))),
                                lerp(v, lerp(u, grad(p[AA + 1], x, y, z - 1),
                                                grad(p[BA + 1], x - 1, y, z - 1)),
                                        lerp(u, grad(p[AB + 1], x, y - 1, z - 1),
                                                grad(p[BB + 1], x - 1, y - 1, z - 1))));
                }
            };
        })();

        function combinedNoise(x: number, z: number) {
            // Base terrain - large rolling hills for the main landscape shape
            let base = 0;
            let freq = 0.008;
            let amp = 30;
            for(let i=0; i < 4; i++) {
                base += perlin.noise(x * freq, z * freq) * amp;
                amp *= 0.5;
                freq *= 2;
            }

            // Detail noise - adds smaller bumps and variations to the surface
            let detail = 0;
            freq = 0.05;
            amp = 4;
            for(let i=0; i < 3; i++) {
                detail += perlin.noise(x * freq, z * freq) * amp;
                amp *= 0.5;
                freq *= 2;
            }

            // Ridged noise creates sharper peaks and valleys for more dramatic features
            let ridged = 0;
            freq = 0.02;
            amp = 15;
            for (let i = 0; i < 4; i++) {
                let n = perlin.noise(x * freq, z * freq);
                n = 1.0 - Math.abs(n); // Invert the noise to create ridges
                ridged += n * amp;
                amp *= 0.5;
                freq *= 2;
            }
            
            // Use a large, slow noise function to create a "continent" map that blends between smooth and ridged terrain
            const blendFactor = (perlin.noise(x * 0.003, z * 0.003) + 1) / 2;
            
            // Combine the different noise layers for the final height value
            return base + detail + (ridged * Math.pow(blendFactor, 2)); // Squaring the blend factor makes transitions sharper
        }

        function pseudoRandom(seed: number) {
            let x = Math.sin(seed) * 10000;
            return x - Math.floor(x);
        }

        const getNormalAt = (x: number, z: number) => {
            const epsilon = 0.01;
            const n_x_plus = combinedNoise(x + epsilon, z);
            const n_x_minus = combinedNoise(x - epsilon, z);
            const n_z_plus = combinedNoise(x, z + epsilon);
            const n_z_minus = combinedNoise(x, z - epsilon);

            const df_dx = (n_x_plus - n_x_minus) / (2 * epsilon);
            const df_dz = (n_z_plus - n_z_minus) / (2 * epsilon);
            
            return new THREE.Vector3(-df_dx, 1, -df_dz).normalize();
        };

        // --- New Terrain Coloring Logic ---
        const SAND_COLOR = { r: 0.9, g: 0.8, b: 0.5 };
        const LUSH_GRASS_COLOR = { r: 0.1, g: 0.4, b: 0.05 };
        const DRY_GRASS_COLOR = { r: 0.4, g: 0.5, b: 0.1 };
        const FOREST_FLOOR_COLOR = { r: 0.2, g: 0.3, b: 0.1 };
        const ROCK_COLOR = { r: 0.5, g: 0.45, b: 0.4 };
        const SNOW_COLOR = { r: 0.95, g: 0.95, b: 1.0 };

        const lerpColor = (c1: {r:number, g:number, b:number}, c2: {r:number, g:number, b:number}, factor: number) => {
            return {
                r: c1.r + (c2.r - c1.r) * factor,
                g: c1.g + (c2.g - c1.g) * factor,
                b: c1.b + (c2.b - c1.b) * factor,
            };
        };

        const getColor = (height: number, worldX: number, worldZ: number, normalY: number) => {
            // Noise values for various effects
            const moisture = (perlin.noise(worldX * 0.005 + 50, worldZ * 0.005 + 50) + 1) / 2;
            const rockinessNoise = (perlin.noise(worldX * 0.05, worldZ * 0.05) + 1) / 2;
            const colorTintNoise = perlin.noise(worldX * 0.008, worldZ * 0.008); // from -1 to 1

            // Determine base grass color from moisture
            const grassColor = lerpColor(DRY_GRASS_COLOR, LUSH_GRASS_COLOR, moisture);

            // Determine base biome color based on height with smooth transitions
            let finalColor;
            const sandLevel = 3;
            const forestLevel = 25;
            const rockLevel = 40;
            const snowLevel = 55;

            if (height < sandLevel) {
                finalColor = SAND_COLOR;
            } else if (height < forestLevel) {
                const factor = (height - sandLevel) / (forestLevel - sandLevel);
                finalColor = lerpColor(grassColor, FOREST_FLOOR_COLOR, factor);
            } else if (height < rockLevel) {
                const factor = (height - forestLevel) / (rockLevel - forestLevel);
                finalColor = lerpColor(FOREST_FLOOR_COLOR, ROCK_COLOR, factor);
            } else if (height < snowLevel) {
                const factor = (height - rockLevel) / (snowLevel - rockLevel);
                finalColor = lerpColor(ROCK_COLOR, SNOW_COLOR, factor);
            } else {
                finalColor = SNOW_COLOR;
            }

            // Apply slope effect (rockiness)
            const slopeFactor = 1.0 - Math.min(1.0, normalY * 1.75); 
            const rockBlend = Math.pow(slopeFactor, 2.0) + rockinessNoise * 0.2;
            finalColor = lerpColor(finalColor, ROCK_COLOR, rockBlend);
            
            // Apply large-scale color tinting for more variety
            if (colorTintNoise > 0) { // warm tint
                finalColor.r += colorTintNoise * 0.08;
                finalColor.g += colorTintNoise * 0.04;
            } else { // cool tint
                finalColor.b -= colorTintNoise * 0.05; // subtract negative to add blue
            }

            // Final brightness adjustment
            const brightness = 0.9 + (perlin.noise(worldX * 0.08, worldZ * 0.08) + 1) / 2 * 0.2;
            
            // Clamp values to be safe
            const clamp = (val: number) => Math.max(0.0, Math.min(1.0, val));

            return [
                clamp(finalColor.r * brightness),
                clamp(finalColor.g * brightness),
                clamp(finalColor.b * brightness)
            ];
        };
        
        const getLeafColor = (worldX: number, worldZ: number, seed: number) => {
            const autumnNoise = (perlin.noise(worldX * 0.02, worldZ * 0.02) + 1) / 2;
            let color;

            if (autumnNoise > 0.6) { // Autumnal area
                const autumnColors = [0xffa500, 0xd2691e, 0x8b0000];
                color = autumnColors[Math.floor(pseudoRandom(seed * 3) * autumnColors.length)];
            } else { // Green area
                const greenColors = [0x228B22, 0x006400, 0x556b2f];
                color = greenColors[Math.floor(pseudoRandom(seed * 3) * greenColors.length)];
            }
            
            const colorObj = new THREE.Color(color);
            colorObj.multiplyScalar(0.85 + pseudoRandom(seed * 2) * 0.3);
            return colorObj;
        };


        function createTerrainChunk(chunkX: number, chunkZ: number) {
            const geometry = new THREE.BufferGeometry();
            const vertices = [];
            const colors: number[] = [];
            const normals: number[] = [];
            const uvs: number[] = [];
            const indices = [];

            const resolution = 25;
            const step = CHUNK_SIZE / resolution;

            for (let rz = 0; rz <= resolution; rz++) {
                for (let rx = 0; rx <= resolution; rx++) {
                    const localX = rx * step;
                    const localZ = rz * step;
                    const worldX = chunkX * CHUNK_SIZE + localX;
                    const worldZ = chunkZ * CHUNK_SIZE + localZ;
                    const height = combinedNoise(worldX, worldZ);
                    
                    vertices.push(localX, height, localZ);

                    const normal = getNormalAt(worldX, worldZ);
                    normals.push(normal.x, normal.y, normal.z);
                    
                    colors.push(...getColor(height, worldX, worldZ, normal.y));
                    
                    uvs.push(rx / resolution, rz / resolution);
                }
            }

            for (let rz = 0; rz < resolution; rz++) {
                for (let rx = 0; rx < resolution; rx++) {
                    const a = rx + (resolution + 1) * rz;
                    const b = rx + (resolution + 1) * (rz + 1);
                    const c = (rx + 1) + (resolution + 1) * rz;
                    const d = (rx + 1) + (resolution + 1) * (rz + 1);
                    indices.push(a, b, c);
                    indices.push(b, d, c);
                }
            }

            geometry.setIndex(indices);
            geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
            geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
            geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
            geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
            
            return geometry;
        }

        function createBottomCap(chunkX: number, chunkZ: number){
            const bottom = new THREE.Mesh(
                new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE),
                new THREE.MeshLambertMaterial({ color: 0x3a2e21 })
            );
            bottom.rotation.x = -Math.PI / 2;
            bottom.position.set(chunkX * CHUNK_SIZE + CHUNK_SIZE / 2, -6, chunkZ * CHUNK_SIZE + CHUNK_SIZE / 2);
            bottom.receiveShadow = true;
            return bottom;
        }

        function createRock() {
            const rock = new THREE.Mesh(
                new THREE.DodecahedronGeometry(1.5, 0),
                new THREE.MeshLambertMaterial({ color: 0x696969 })
            );
            rock.position.y = 0.8; rock.castShadow = true;
            rock.scale.set(0.8 + Math.random() * 0.4, 0.6 + Math.random() * 0.6, 0.8 + Math.random() * 0.4);
            return rock;
        }

        function createVegetationChunk(chunkX: number, chunkZ: number) {
            const group = new THREE.Group();
            const seed = chunkX * 1000 + chunkZ;
            let vegRandom = pseudoRandom(seed);
            
            const defaultTreeMatrices = [];
            const pineTreeMatrices = [];
            const bushMatrices = [];
            const flowerStemMatrices = [];
            const flowerLeafMatrices = [];
            const flowerHeadData = []; // { matrix, color }
            
            const maxObjects = 50; // Increased density for smaller foliage
            const flowerColors = [0xff69b4, 0xffff00, 0x9400d3, 0x1e90ff];

            for (let i = 0; i < maxObjects; i++) {
                vegRandom = pseudoRandom(vegRandom * 12.9898);
                const rx = vegRandom * CHUNK_SIZE;
                vegRandom = pseudoRandom(vegRandom * 12.9898);
                const rz = vegRandom * CHUNK_SIZE;

                const wx = chunkX * CHUNK_SIZE + rx;
                const wz = chunkZ * CHUNK_SIZE + rz;
                const h = combinedNoise(wx, wz);
                if (h < 2) continue; // No veg on sand/beach

                const normal = getNormalAt(wx, wz);
                const isSteep = normal.y < 0.7;

                const ef = Math.max(0.3, Math.min(1, h / 15)); // elevation factor
                vegRandom = pseudoRandom(vegRandom * 12.9898);

                if (isSteep && vegRandom < 0.6) { // High chance for rock clusters on steep slopes
                    const clusterSize = 2 + Math.floor(pseudoRandom(vegRandom * 12.9898) * 4);
                    for (let j = 0; j < clusterSize; j++) {
                        const rock = createRock();
                        vegRandom = pseudoRandom(vegRandom * 12.9898);
                        const offsetX = (vegRandom - 0.5) * 5;
                        vegRandom = pseudoRandom(vegRandom * 12.9898);
                        const offsetZ = (vegRandom - 0.5) * 5;
                        const rockWx = wx + offsetX;
                        const rockWz = wz + offsetZ;
                        const rockH = combinedNoise(rockWx, rockWz);
                        if (Math.abs(rockH - h) > 2.5) continue;

                        rock.position.set(rockWx, rockH, rockWz);
                        vegRandom = pseudoRandom(vegRandom * 12.9898);
                        rock.rotation.y = vegRandom * Math.PI * 2;
                        vegRandom = pseudoRandom(vegRandom * 12.9898);
                        rock.scale.setScalar(0.7 + vegRandom * 0.8);
                        group.add(rock);
                    }
                } else if (vegRandom < 0.3 * ef && !isSteep) { // Generate a tree
                    vegRandom = pseudoRandom(vegRandom * 12.9898);
                    const rotY = vegRandom * Math.PI * 2;
                    vegRandom = pseudoRandom(vegRandom * 12.9898);
                    let scaleY = 0.7 + vegRandom * 0.6;
                    vegRandom = pseudoRandom(vegRandom * 12.9898);
                    let scaleXZ = 0.8 + vegRandom * 0.4;
                    
                    tempObject.position.set(wx, h, wz);
                    tempObject.quaternion.identity();
                    tempObject.rotateY(rotY);
                    
                    vegRandom = pseudoRandom(vegRandom * 12.9898);
                    const treeType = vegRandom;
                    
                    if (treeType < 0.7) { // Default Tree
                        tempObject.scale.set(scaleXZ, scaleY, scaleXZ);
                        tempObject.updateMatrix();
                        defaultTreeMatrices.push({matrix: tempObject.matrix.clone(), wx, wz, seed: vegRandom * i});
                    } else { // Pine Tree
                        scaleY = 0.9 + vegRandom * 0.4;
                        scaleXZ = 0.7 + vegRandom * 0.3;
                        tempObject.scale.set(scaleXZ, scaleY, scaleXZ);
                        tempObject.updateMatrix();
                        pineTreeMatrices.push({matrix: tempObject.matrix.clone(), wx, wz, seed: vegRandom * i});
                    }
                } else if (vegRandom < 0.6 * ef && !isSteep) { // Place a bush
                    vegRandom = pseudoRandom(vegRandom * 12.9898);
                    const scale = 0.8 + vegRandom * 0.8;
                    tempObject.position.set(wx, h, wz);
                    tempObject.scale.setScalar(scale);
                    tempObject.updateMatrix();
                    bushMatrices.push(tempObject.matrix.clone());
                } else if (vegRandom < 0.7 * ef && !isSteep) { // Place a flower cluster
                    const clusterSize = 3 + Math.floor(pseudoRandom(vegRandom * 12.9898) * 5);
                    vegRandom = pseudoRandom(vegRandom * 12.9898);
                    const clusterColor = new THREE.Color(flowerColors[Math.floor(vegRandom * flowerColors.length)]);
                    
                    for (let j = 0; j < clusterSize; j++) {
                        vegRandom = pseudoRandom(vegRandom * 12.9898);
                        const offsetX = (vegRandom - 0.5) * 2;
                        vegRandom = pseudoRandom(vegRandom * 12.9898);
                        const offsetZ = (vegRandom - 0.5) * 2;
                        const flowerWx = wx + offsetX;
                        const flowerWz = wz + offsetZ;
                        const flowerH = combinedNoise(flowerWx, flowerWz);
                        if (Math.abs(flowerH - h) > 1.0) continue; // Keep cluster on same level

                        vegRandom = pseudoRandom(vegRandom * 12.9898);
                        const scale = 0.7 + vegRandom * 0.6;

                        tempObject.position.set(flowerWx, flowerH, flowerWz);
                        tempObject.scale.setScalar(scale);
                        tempObject.updateMatrix();
                        
                        const stemMatrix = tempObject.matrix.clone();
                        flowerStemMatrices.push(stemMatrix);
                        
                        const colorVariation = (pseudoRandom(vegRandom * 12.9898) - 0.5) * 0.2;
                        flowerHeadData.push({ 
                            matrix: stemMatrix,
                            color: clusterColor.clone().multiplyScalar(1.0 + colorVariation)
                        });

                        // Add leaves
                        vegRandom = pseudoRandom(vegRandom * 12.9898);
                        const leafCount = 1 + Math.floor(vegRandom * 2); // 1 or 2 leaves
                        for (let k = 0; k < leafCount; k++) {
                            const leafMatrix = stemMatrix.clone();
                            const rotationMatrix = new THREE.Matrix4().makeRotationY((pseudoRandom(vegRandom * k * 13.37) * Math.PI * 2));
                            leafMatrix.multiply(rotationMatrix);
                            flowerLeafMatrices.push(leafMatrix);
                        }
                    }
                } else if (vegRandom < 0.8 * ef) { // Generate a single rock
                    const rock = createRock(); rock.position.set(wx, h, wz); 
                    vegRandom = pseudoRandom(vegRandom * 12.9898);
                    rock.rotation.y = vegRandom * Math.PI * 2;
                    vegRandom = pseudoRandom(vegRandom * 12.9898);
                    rock.scale.setScalar(0.5 + vegRandom * 0.5); 
                    group.add(rock);
                }
            }

            // Create Instanced Meshes for Default Trees
            if (defaultTreeMatrices.length > 0) {
                const trunks = new THREE.InstancedMesh(TRUNK_GEOMETRY, TRUNK_MATERIAL, defaultTreeMatrices.length);
                const leaves = new THREE.InstancedMesh(LEAVES_GEOMETRY, LEAVES_MATERIAL, defaultTreeMatrices.length);
                trunks.castShadow = true;
                leaves.castShadow = true;

                for (let i = 0; i < defaultTreeMatrices.length; i++) {
                    const data = defaultTreeMatrices[i];
                    trunks.setMatrixAt(i, data.matrix);
                    leaves.setMatrixAt(i, data.matrix);

                    tempColor.setHex(0x8B4513).multiplyScalar(0.9 + pseudoRandom(data.seed) * 0.2);
                    trunks.setColorAt(i, tempColor);
                    
                    leaves.setColorAt(i, getLeafColor(data.wx, data.wz, data.seed));
                }
                if (trunks.instanceColor) trunks.instanceColor.needsUpdate = true;
                if (leaves.instanceColor) leaves.instanceColor.needsUpdate = true;
                
                group.add(trunks);
                group.add(leaves);
            }

            // Create Instanced Meshes for Pine Trees
            if (pineTreeMatrices.length > 0) {
                const trunks = new THREE.InstancedMesh(PINE_TRUNK_GEOMETRY, TRUNK_MATERIAL, pineTreeMatrices.length);
                const leaves1 = new THREE.InstancedMesh(PINE_LEAVES1_GEOMETRY, PINE_LEAVES_MATERIAL, pineTreeMatrices.length);
                const leaves2 = new THREE.InstancedMesh(PINE_LEAVES2_GEOMETRY, PINE_LEAVES_MATERIAL, pineTreeMatrices.length);
                const leaves3 = new THREE.InstancedMesh(PINE_LEAVES3_GEOMETRY, PINE_LEAVES_MATERIAL, pineTreeMatrices.length);
                const allParts = [trunks, leaves1, leaves2, leaves3];

                allParts.forEach(p => p.castShadow = true);

                for (let i = 0; i < pineTreeMatrices.length; i++) {
                    const data = pineTreeMatrices[i];
                    
                    tempColor.setHex(0x654321).multiplyScalar(0.9 + pseudoRandom(data.seed) * 0.2);
                    const leafColor = getLeafColor(data.wx, data.wz, data.seed);

                    allParts.forEach(p => {
                        p.setMatrixAt(i, data.matrix);
                        if (p === trunks) p.setColorAt(i, tempColor);
                        else p.setColorAt(i, leafColor);
                    });
                }
                
                allParts.forEach(p => {
                    if (p.instanceColor) p.instanceColor.needsUpdate = true;
                    group.add(p);
                });
            }

            // Create Instanced Meshes for Bushes
            if (bushMatrices.length > 0) {
                const bushes = new THREE.InstancedMesh(BUSH_GEOMETRY, BUSH_MATERIAL, bushMatrices.length);
                bushes.castShadow = true;
                for (let i = 0; i < bushMatrices.length; i++) {
                    bushes.setMatrixAt(i, bushMatrices[i]);
                    bushes.setColorAt(i, tempColor.setHex(0x2e4432).multiplyScalar(0.9 + pseudoRandom(i) * 0.2));
                }
                if (bushes.instanceColor) bushes.instanceColor.needsUpdate = true;
                group.add(bushes);
            }
            
            // Create Instanced Meshes for Flowers
            if (flowerStemMatrices.length > 0) {
                const stems = new THREE.InstancedMesh(FLOWER_STEM_GEOMETRY, FLOWER_STEM_MATERIAL, flowerStemMatrices.length);
                const heads = new THREE.InstancedMesh(FLOWER_HEAD_GEOMETRY, FLOWER_HEAD_MATERIAL, flowerHeadData.length);
                const leaves = new THREE.InstancedMesh(FLOWER_LEAF_GEOMETRY, FLOWER_LEAF_MATERIAL, flowerLeafMatrices.length);
                stems.castShadow = true;
                heads.castShadow = true;
                leaves.castShadow = true;

                for (let i = 0; i < flowerStemMatrices.length; i++) {
                    stems.setMatrixAt(i, flowerStemMatrices[i]);
                }
                for (let i = 0; i < flowerHeadData.length; i++) {
                    heads.setMatrixAt(i, flowerHeadData[i].matrix);
                    heads.setColorAt(i, flowerHeadData[i].color);
                }
                 for (let i = 0; i < flowerLeafMatrices.length; i++) {
                    leaves.setMatrixAt(i, flowerLeafMatrices[i]);
                }
                if (heads.instanceColor) heads.instanceColor.needsUpdate = true;

                group.add(stems);
                group.add(heads);
                group.add(leaves);
            }

            return group;
        }

        /* ---------------  Chunk manager  ----------------- */
        const getKey = (x: number, z: number) => `${x},${z}`;
        function updateChunks() {
            const pcx = Math.floor(camera.position.x / CHUNK_SIZE);
            const pcz = Math.floor(camera.position.z / CHUNK_SIZE);
            const keep = new Set();
            for (let x = -RENDER_DISTANCE; x <= RENDER_DISTANCE; x++) {
                for (let z = -RENDER_DISTANCE; z <= RENDER_DISTANCE; z++) {
                    const cx = pcx + x, cz = pcz + z, key = getKey(cx, cz);
                    keep.add(key);
                    if (!chunks.has(key)) {
                        const geom = createTerrainChunk(cx, cz);
                        const mesh = new THREE.Mesh(geom, terrainMaterial);
                        mesh.position.set(cx * CHUNK_SIZE, 0, cz * CHUNK_SIZE);
                        mesh.receiveShadow = true;
                        scene.add(mesh); chunks.set(key, mesh);
                        const bottom = createBottomCap(cx, cz); scene.add(bottom); bottomCaps.set(key, bottom);
                        const veg = createVegetationChunk(cx, cz); scene.add(veg); vegetationChunks.set(key, veg);
                    }
                }
            }
            chunks.forEach((m, k) => { 
                if (!keep.has(k)) { 
                    scene.remove(m); 
                    m.geometry.dispose();
                    chunks.delete(k); 
                } 
            });
            bottomCaps.forEach((m, k) => {
                if (!keep.has(k)) {
                    scene.remove(m);
                    m.geometry.dispose();
                    if (m.material) m.material.dispose();
                    bottomCaps.delete(k);
                }
            });
            vegetationChunks.forEach((group, k) => {
                if (!keep.has(k)) {
                    scene.remove(group);
                    // Dispose individual non-instanced meshes like rocks
                    group.traverse(obj => {
                        if (obj.isMesh && !obj.isInstancedMesh) {
                            if (obj.geometry) obj.geometry.dispose();
                            if (obj.material) obj.material.dispose();
                        }
                    });
                    vegetationChunks.delete(k);
                }
            });
        }

        /* ---------------  Controls  ----------------- */
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Tab') {
                e.preventDefault();
                setShowControls(prev => !prev);
                return;
            }
            switch (e.key.toLowerCase()) {
                case 'w': mv.current.forward = true; break;
                case 's': mv.current.backward = true; break;
                case 'a': mv.current.left = true; break;
                case 'd': mv.current.right = true; break;
                case ' ': e.preventDefault(); mv.current.up = true; break;
                case 'shift': mv.current.boost = true; break;
                case 'control': e.preventDefault(); mv.current.down = true; break;
            }
        };
        const handleKeyUp = (e: KeyboardEvent) => {
            switch (e.key.toLowerCase()) {
                case 'w': mv.current.forward = false; break;
                case 's': mv.current.backward = false; break;
                case 'a': mv.current.left = false; break;
                case 'd': mv.current.right = false; break;
                case ' ': mv.current.up = false; break;
                case 'shift': mv.current.boost = false; break;
                case 'control': mv.current.down = false; break;
            }
        };
        const handleClick = () => renderer.domElement.requestPointerLock();
        const handleMouseMove = (e: MouseEvent) => {
            if (document.pointerLockElement === renderer.domElement) {
                look.current.lon += e.movementX * 0.1;
                look.current.lat -= e.movementY * 0.1;
                look.current.lat = Math.max(-85, Math.min(85, look.current.lat));
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('keyup', handleKeyUp);
        renderer.domElement.addEventListener('click', handleClick);
        document.addEventListener('mousemove', handleMouseMove);

        /* ---------------  Mobile Controls  ----------------- */
        const lookTouch = { id: -1, lastX: 0, lastY: 0 };
        const moveTouch = { id: -1, startX: 0, startY: 0 };
        const joystickContainer = document.getElementById('joystick-container');
        const joystickHandle = document.getElementById('joystick-handle');
        
        const handleTouchStart = (e: TouchEvent) => {
            e.preventDefault();
            for (const touch of Array.from(e.changedTouches)) {
                if (touch.clientX > window.innerWidth / 2 && lookTouch.id === -1) {
                    lookTouch.id = touch.identifier;
                    lookTouch.lastX = touch.clientX;
                    lookTouch.lastY = touch.clientY;
                } else if (touch.clientX <= window.innerWidth / 2 && moveTouch.id === -1) {
                    moveTouch.id = touch.identifier;
                    moveTouch.startX = touch.clientX;
                    moveTouch.startY = touch.clientY;
                    if (joystickContainer) {
                        joystickContainer.style.display = 'flex';
                        joystickContainer.style.left = `${touch.clientX - 60}px`;
                        joystickContainer.style.top = `${touch.clientY - 60}px`;
                    }
                }
            }
        };

        const handleTouchMove = (e: TouchEvent) => {
            e.preventDefault();
            for (const touch of Array.from(e.changedTouches)) {
                if (touch.identifier === lookTouch.id) {
                    const dx = touch.clientX - lookTouch.lastX;
                    const dy = touch.clientY - lookTouch.lastY;
                    look.current.lon += dx * 0.2;
                    look.current.lat -= dy * 0.2;
                    look.current.lat = Math.max(-85, Math.min(85, look.current.lat));
                    lookTouch.lastX = touch.clientX;
                    lookTouch.lastY = touch.clientY;
                } else if (touch.identifier === moveTouch.id) {
                    const dx = touch.clientX - moveTouch.startX;
                    const dy = touch.clientY - moveTouch.startY;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    const angle = Math.atan2(dy, dx);
                    if (joystickHandle) {
                       const maxDist = 60;
                       const clampedDist = Math.min(dist, maxDist);
                       joystickHandle.style.transform = `translate(${clampedDist * Math.cos(angle)}px, ${clampedDist * Math.sin(angle)}px)`;
                    }
                    if (dist > 20) { // Deadzone
                        mv.current.forward = dy < -10;
                        mv.current.backward = dy > 10;
                        mv.current.left = dx < -10;
                        mv.current.right = dx > 10;
                    } else {
                        mv.current.forward = mv.current.backward = mv.current.left = mv.current.right = false;
                    }
                }
            }
        };

        const handleTouchEnd = (e: TouchEvent) => {
            for (const touch of Array.from(e.changedTouches)) {
                if (touch.identifier === lookTouch.id) {
                    lookTouch.id = -1;
                } else if (touch.identifier === moveTouch.id) {
                    moveTouch.id = -1;
                    mv.current.forward = mv.current.backward = mv.current.left = mv.current.right = false;
                    if (joystickContainer) joystickContainer.style.display = 'none';
                    if (joystickHandle) joystickHandle.style.transform = 'translate(0, 0)';
                }
            }
        };
        
        renderer.domElement.addEventListener('touchstart', handleTouchStart);
        renderer.domElement.addEventListener('touchmove', handleTouchMove);
        renderer.domElement.addEventListener('touchend', handleTouchEnd);
        renderer.domElement.addEventListener('touchcancel', handleTouchEnd);

        /* ---------------  Animate  ----------------- */
        let frame = 0, last = performance.now();
        let animationFrameId: number;
        const tempFishObject = new THREE.Object3D();
        const swimBounds = { radius: 150, top: -1, bottom: -15 };
        const schoolCenter = new THREE.Vector3();
        const tempCloudObject = new THREE.Object3D();

        function animate() {
            animationFrameId = requestAnimationFrame(animate);
            const now = performance.now();
            const timeSeconds = now * 0.001;

            const phi = THREE.MathUtils.degToRad(90 - look.current.lat);
            const theta = THREE.MathUtils.degToRad(look.current.lon);
            const lookVec = new THREE.Vector3(Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta));
            camera.lookAt(camera.position.clone().add(lookVec));
            const speed = (mv.current.boost ? 3 : 1) * 0.5;
            const dir = new THREE.Vector3();
            if (mv.current.forward) dir.add(lookVec.clone().setY(0).normalize());
            if (mv.current.backward) dir.sub(lookVec.clone().setY(0).normalize());
            const sideVec = new THREE.Vector3().crossVectors(lookVec, camera.up).setY(0).normalize();
            if (mv.current.left) dir.sub(sideVec);
            if (mv.current.right) dir.add(sideVec);
            if (mv.current.up) dir.y += 1;
            if (mv.current.down) dir.y -= 1;
            camera.position.add(dir.normalize().multiplyScalar(speed));
            updateChunks();
            
            if (waterRef.current) {
                waterRef.current.material.uniforms['time'].value += 1.0 / 60.0;
            }

            // Update wind uniforms for tree animation
            windUniforms.uTime.value = timeSeconds;
            windUniforms.uWindStrength.value = windParamsRef.current.strength * (0.8 + perlin.noise(timeSeconds * 0.1, 0) * 0.2); // Add gentle gusts
            
            // Animate clouds
            if(cloudMeshRef.current && cloudDataRef.current.length > 0) {
                cloudDataRef.current.forEach((cloud, i) => {
                    // Main movement on X-axis
                    cloud.x += cloud.speed * cloudParamsRef.current.speed * 0.1;
                    // Z-axis drift for dynamic wind effect
                    cloud.z += cloud.z_speed * cloudParamsRef.current.speed * 0.1;
                    
                    // Wrap around logic
                    if(cloud.x > cloudAreaSize / 2) cloud.x = -cloudAreaSize / 2;
                    else if (cloud.x < -cloudAreaSize / 2) cloud.x = -cloudAreaSize / 2;
                    if(cloud.z > cloudAreaSize / 2) cloud.z = -cloudAreaSize / 2;
                    else if (cloud.z < -cloudAreaSize / 2) cloud.z = -cloudAreaSize / 2;
                    
                    cloudMeshRef.current.getMatrixAt(i, tempCloudObject.matrix);
                    const position = new THREE.Vector3();
                    const quaternion = new THREE.Quaternion();
                    const scale = new THREE.Vector3();
                    tempCloudObject.matrix.decompose(position, quaternion, scale);
                    position.x = cloud.x;
                    position.z = cloud.z;
                    tempCloudObject.matrix.compose(position, quaternion, scale);
                    cloudMeshRef.current.setMatrixAt(i, tempCloudObject.matrix);
                });
                cloudMeshRef.current.instanceMatrix.needsUpdate = true;
            }


            // Animate fish
            if (fishMeshRef.current && fishDataRef.current.length > 0) {
                schoolCenter.set(0,0,0);
                fishDataRef.current.forEach(fish => schoolCenter.add(fish.position));
                schoolCenter.divideScalar(fishDataRef.current.length);

                fishDataRef.current.forEach((fish, i) => {
                    // Cohesion: Steer towards the center of the school
                    const toCenter = schoolCenter.clone().sub(fish.position).normalize().multiplyScalar(0.001);
                    fish.velocity.add(toCenter);

                    // Boundary avoidance
                    const distFromCenter = fish.position.length();
                    if (distFromCenter > swimBounds.radius) {
                        fish.velocity.add(fish.position.clone().multiplyScalar(-0.002));
                    }
                    if (fish.position.y > swimBounds.top) fish.velocity.y -= 0.01;
                    if (fish.position.y < swimBounds.bottom) fish.velocity.y += 0.01;

                    // Update position and clamp speed
                    fish.velocity.clampLength(0.05, 0.15);
                    fish.position.add(fish.velocity);

                    // Update matrix for instanced mesh
                    tempFishObject.position.copy(fish.position);
                    tempFishObject.lookAt(fish.position.clone().add(fish.velocity));
                    tempFishObject.updateMatrix();
                    fishMeshRef.current.setMatrixAt(i, tempFishObject.matrix);
                });
                fishMeshRef.current.instanceMatrix.needsUpdate = true;
            }


            frame++;
            if (now - last >= 1000) {
                setFps(frame);
                setPosition(`${camera.position.x.toFixed(1)}, ${camera.position.y.toFixed(1)}, ${camera.position.z.toFixed(1)}`);
                setChunkCount(chunks.size);
                frame = 0;
                last = now;
            }
            composer.render();
        }

        const handleResize = () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
            composer.setSize(window.innerWidth, window.innerHeight);
        };
        window.addEventListener('resize', handleResize);

        updateChunks();
        animate();

        // Cleanup function
        return () => {
            cancelAnimationFrame(animationFrameId);
            window.removeEventListener('resize', handleResize);
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('keyup', handleKeyUp);
            renderer.domElement.removeEventListener('click', handleClick);
            document.removeEventListener('mousemove', handleMouseMove);
            renderer.domElement.removeEventListener('touchstart', handleTouchStart);
            renderer.domElement.removeEventListener('touchmove', handleTouchMove);
            renderer.domElement.removeEventListener('touchend', handleTouchEnd);
            renderer.domElement.removeEventListener('touchcancel', handleTouchEnd);

            if (mountRef.current) {
                mountRef.current.removeChild(renderer.domElement);
            }
            // Dispose Three.js objects
            scene.traverse(object => {
                if (object.geometry) object.geometry.dispose();
                if (object.material) {
                     if (Array.isArray(object.material)) {
                        object.material.forEach(material => material.dispose());
                    } else {
                        object.material.dispose();
                    }
                }
            });
            terrainMaterial.dispose();
            groundTextureRef.current?.dispose();
            // Also dispose the globally defined geometries and materials
            TRUNK_GEOMETRY?.dispose();
            LEAVES_GEOMETRY?.dispose();
            PINE_TRUNK_GEOMETRY?.dispose();
            PINE_LEAVES1_GEOMETRY?.dispose();
            PINE_LEAVES2_GEOMETRY?.dispose();
            PINE_LEAVES3_GEOMETRY?.dispose();
            TRUNK_MATERIAL?.dispose();
            LEAVES_MATERIAL?.dispose();
            PINE_LEAVES_MATERIAL?.dispose();
            FISH_GEOMETRY?.dispose();
            FISH_MATERIAL?.dispose();
            CLOUD_GEOMETRY?.dispose();
            CLOUD_MATERIAL?.dispose();
            BUSH_GEOMETRY?.dispose();
            BUSH_MATERIAL?.dispose();
            FLOWER_STEM_GEOMETRY?.dispose();
            FLOWER_HEAD_GEOMETRY?.dispose();
            FLOWER_STEM_MATERIAL?.dispose();
            FLOWER_HEAD_MATERIAL?.dispose();
            FLOWER_LEAF_GEOMETRY?.dispose();
            FLOWER_LEAF_MATERIAL?.dispose();
            renderer.dispose();
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className="w-screen h-screen relative">
            {showControls && (
                <>
                    <div id="info">
                        <strong>Low Poly Procedural World</strong><br />
                        FPS: <span id="fps">{fps}</span><br />
                        Position: <span id="position">{position}</span><br />
                        Chunks: <span id="chunks">{chunkCount}</span>
                    </div>
                    <div id="controls">
                        WASD - Move<br />
                        Mouse - Look<br />
                        Shift - Boost<br />
                        Space - Up<br />
                        Ctrl - Down<br/>
                        Tab - Toggle Panels
                    </div>
                    <div id="terrain-controls" className="controls-panel">
                        <strong>Terrain Controls</strong>
                        <div>
                            <label>Tex Scale</label>
                            <input type="range" min="1" max="100" step="1" value={groundParams.scale} onChange={(e) => setGroundParams(p => ({ ...p, scale: parseInt(e.target.value) }))} />
                            <span>{groundParams.scale}</span>
                        </div>
                         <div>
                            <label>Texture</label>
                            <input className="w-5 h-5 accent-sky-500" type="checkbox" checked={groundParams.showTexture} onChange={(e) => setGroundParams(p => ({ ...p, showTexture: e.target.checked }))} />
                            <div className="flex-grow"></div>
                            <span />
                        </div>
                    </div>
                    <div id="cloud-controls" className="controls-panel">
                        <strong>Cloud Controls</strong>
                        <p className="text-xs text-gray-400 mt-1 mb-2">Note: High counts may impact performance.</p>
                        <div>
                            <label>Count</label>
                            <input type="range" min="0" max="1000" step="1" value={cloudParams.count} onChange={(e) => setCloudParams(p => ({ ...p, count: parseInt(e.target.value) }))} />
                            <span>{cloudParams.count}</span>
                        </div>
                        <div>
                            <label>Speed</label>
                            <input type="range" min="0" max="15" step="0.1" value={cloudParams.speed} onChange={(e) => setCloudParams(p => ({ ...p, speed: parseFloat(e.target.value) }))} />
                            <span>{cloudParams.speed.toFixed(1)}</span>
                        </div>
                    </div>
                    <div id="wind-controls" className="controls-panel">
                        <strong>Wind Controls</strong>
                        <div>
                            <label>Strength</label>
                            <input type="range" min="0" max="1" step="0.01" value={windParams.strength} onChange={(e) => setWindParams(p => ({ ...p, strength: parseFloat(e.target.value) }))} />
                            <span>{windParams.strength.toFixed(2)}</span>
                        </div>
                    </div>
                    <div id="bloom-controls" className="controls-panel">
                        <strong>Bloom & Light Controls</strong>
                        <div>
                            <label>Threshold</label>
                            <input type="range" min="0" max="1" step="0.01" value={bloomParams.threshold} onChange={(e) => setBloomParams(p => ({ ...p, threshold: parseFloat(e.target.value) }))} />
                            <span>{bloomParams.threshold.toFixed(2)}</span>
                        </div>
                        <div>
                            <label>Strength</label>
                            <input type="range" min="0" max="3" step="0.1" value={bloomParams.strength} onChange={(e) => setBloomParams(p => ({ ...p, strength: parseFloat(e.target.value) }))} />
                            <span>{bloomParams.strength.toFixed(1)}</span>
                        </div>
                        <div>
                            <label>Radius</label>
                            <input type="range" min="0" max="1" step="0.01" value={bloomParams.radius} onChange={(e) => setBloomParams(p => ({ ...p, radius: parseFloat(e.target.value) }))} />
                            <span>{bloomParams.radius.toFixed(2)}</span>
                        </div>
                        <div>
                            <label>Ambient</label>
                            <input type="range" min="0" max="2" step="0.1" value={ambientIntensity} onChange={(e) => setAmbientIntensity(parseFloat(e.target.value))} />
                            <span>{ambientIntensity.toFixed(1)}</span>
                        </div>
                    </div>
                </>
            )}
             {isMobile && (
                <>
                    <div id="joystick-container">
                        <div id="joystick-handle"></div>
                    </div>
                    <div id="action-buttons">
                        <div className="action-btn" onTouchStart={() => mv.current.up = true} onTouchEnd={() => mv.current.up = false}>▲</div>
                        <div className="action-btn" onTouchStart={() => mv.current.down = true} onTouchEnd={() => mv.current.down = false}>▼</div>
                        <div className="action-btn" onTouchStart={() => mv.current.boost = true} onTouchEnd={() => mv.current.boost = false}>🚀</div>
                    </div>
                </>
            )}
            <div ref={mountRef} className="w-full h-full" />
        </div>
    );
};

export default App;
