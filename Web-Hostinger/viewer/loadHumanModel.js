import { BODY_COLOR, INACTIVE_MUSCLE_COLOR } from './visualStyle.js?v=0.5.2';
function parseGlb(buffer) {
    const view = new DataView(buffer);
    if (view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2)
        throw new Error('Invalid GLB');
    let offset = 12;
    let json;
    let bin = new ArrayBuffer(0);
    while (offset + 8 <= buffer.byteLength) {
        const length = view.getUint32(offset, true);
        const type = view.getUint32(offset + 4, true);
        const start = offset + 8;
        if (type === 0x4e4f534a) {
            json = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, start, length)).trimEnd());
        }
        else if (type === 0x004e4942) {
            bin = buffer.slice(start, start + length);
        }
        offset = start + length;
    }
    if (!json)
        throw new Error('GLB JSON missing');
    return { json, bin };
}
function componentSize(type) {
    if (type === 5126 || type === 5125)
        return 4;
    if (type === 5123 || type === 5122)
        return 2;
    return 1;
}
function typeSize(type) {
    return type === 'VEC4' ? 4 : type === 'VEC3' ? 3 : type === 'VEC2' ? 2 : 1;
}
function accessorValues(json, bin, accessorIndex) {
    const accessor = json.accessors?.[accessorIndex];
    if (!accessor)
        throw new Error(`Accessor ${accessorIndex} missing`);
    const bv = json.bufferViews?.[accessor.bufferView];
    if (!bv)
        throw new Error(`BufferView ${accessor.bufferView} missing`);
    const comps = typeSize(accessor.type);
    const csize = componentSize(accessor.componentType);
    const stride = bv.byteStride ?? comps * csize;
    const base = (bv.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
    const dv = new DataView(bin);
    const values = [];
    for (let i = 0; i < accessor.count; i++) {
        for (let c = 0; c < comps; c++) {
            const off = base + i * stride + c * csize;
            switch (accessor.componentType) {
                case 5126:
                    values.push(dv.getFloat32(off, true));
                    break;
                case 5125:
                    values.push(dv.getUint32(off, true));
                    break;
                case 5123:
                    values.push(dv.getUint16(off, true));
                    break;
                case 5122:
                    values.push(dv.getInt16(off, true));
                    break;
                case 5121:
                    values.push(dv.getUint8(off));
                    break;
                default: throw new Error(`Unsupported component type ${accessor.componentType}`);
            }
        }
    }
    return values;
}
export async function loadHumanModel(gl, url) {
    const response = await fetch(url);
    if (!response.ok)
        throw new Error(`Model load failed: ${response.status}`);
    const { json, bin } = parseGlb(await response.arrayBuffer());
    const meshes = [];
    for (const node of json.nodes ?? []) {
        if (node.mesh === undefined || !node.name)
            continue;
        const meshDef = json.meshes?.[node.mesh];
        if (!meshDef)
            continue;
        for (const primitive of meshDef.primitives) {
            if (primitive.attributes.POSITION === undefined || primitive.indices === undefined)
                continue;
            const positions = new Float32Array(accessorValues(json, bin, primitive.attributes.POSITION));
            const rawNormals = primitive.attributes.NORMAL === undefined
                ? Array.from({ length: positions.length }, (_, index) => index % 3 === 2 ? 1 : 0)
                : accessorValues(json, bin, primitive.attributes.NORMAL);
            const normals = new Float32Array(rawNormals);
            const rawIndices = accessorValues(json, bin, primitive.indices);
            if (Math.max(...rawIndices) > 65535)
                throw new Error(`Mesh ${node.name} exceeds 16-bit indices`);
            const indices = new Uint16Array(rawIndices);
            const positionBuffer = gl.createBuffer();
            const normalBuffer = gl.createBuffer();
            const indexBuffer = gl.createBuffer();
            if (!positionBuffer || !normalBuffer || !indexBuffer)
                throw new Error('WebGL buffer allocation failed');
            gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
            gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, normals, gl.STATIC_DRAW);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
            const baseColor = node.name.startsWith('muscle__')
                ? [...INACTIVE_MUSCLE_COLOR]
                : [...BODY_COLOR];
            meshes.push({ name: node.name, positionBuffer, normalBuffer, indexBuffer, indexCount: indices.length, baseColor, color: [...baseColor] });
        }
    }
    return {
        meshes,
        dispose() {
            for (const mesh of meshes) {
                gl.deleteBuffer(mesh.positionBuffer);
                gl.deleteBuffer(mesh.normalBuffer);
                gl.deleteBuffer(mesh.indexBuffer);
            }
        },
    };
}
