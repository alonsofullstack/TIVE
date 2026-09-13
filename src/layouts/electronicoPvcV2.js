/**
 * CONFIGURACIÓN EDITABLE — ELECTRÓNICO PVC V2.0
 *
 * Coordenadas:
 *   x: aumenta hacia la derecha.
 *   y: aumenta hacia abajo.
 *   size: tamaño de letra.
 *   width/height: ancho y alto de imágenes/códigos.
 */

const plantillas = {
    anverso: 'ELECTRONICA PVC   v2.0.pdf',
    reverso: 'PARTE POSTERIOS ELECTRONICA PVC   v2.0.pdf'
};

const recorte = {
    anverso: { top: 0, bottom: 0, left: 0, right: 0 },
    reverso: { top: 0, bottom: 0, left: 0, right: 0 }
};

const anverso = {
    zona: { x: 56, y: 34.5, size: 5.2, color: 'gris' },
    sede: { x: 51, y: 42.5, size: 5.2, color: 'gris' },
    partida: { x: 63, y: 55, size: 6.8, color: 'negro' },
    dua: { x: 46, y: 69.5, size: 6.8, color: 'negro' },
    titulo: { x: 32.5, y: 84.5, size: 6.8, color: 'negro' },
    fechaTitulo: { x: 58, y: 98, size: 6.8, color: 'negro' },
    placa: { x: 155, y: 68, size: 15, color: 'negro' },
    codVerif: { x: 211, y: 132.5, size: 4.5, color: 'negro' },
    tituloNo: { x: 178, y: 141, size: 4.5, color: 'negro' },
    fechaFinal: { x: 172, y: 149, size: 4.5, color: 'negro' },

    // Imágenes: x/y corresponden a la esquina superior izquierda.
    codigoBarras: { x: 10.5, y: 130.5, width: 70, height: 18 },
    qr: { x: 95, y: 101.5, width: 54, height: 50 }
};

const reverso = {
    // Datos principales — izquierda
    categoria: { x: 37, y: 23.5, size: 4.5 },
    marca: { x: 37, y: 30.5, size: 4.5 },
    modelo: { x: 37, y: 37.5, size: 4.5 },
    color: { x: 37, y: 45, size: 4.5 },
    vin: { x: 59, y: 53, size: 4.5 },
    serie: { x: 59, y: 60, size: 4.5 },
    motor: { x: 61, y: 67, size: 4.5 },
    carroceria: { x: 59, y: 74.5, size: 4.5 },
    potencia: { x: 45, y: 81, size: 4.5 },
    formRod: { x: 47, y: 88, size: 4.5 },
    combustible: { x: 48, y: 95, size: 4.5 },

    // Datos principales — derecha
    añoModelo: { x: 222, y: 22.5, size: 4.5 },
    version: { x: 144, y: 83.7, size: 4.5 },

    // Especificaciones inferiores
    asientos: { x: 47, y: 103.4, size: 4.5 },
    pasajeros: { x: 47, y: 110.4, size: 4.5 },
    ruedas: { x: 47, y: 117.4, size: 4.5 },
    ejes: { x: 47, y: 125, size: 4.5 },
    cilindros: { x: 115, y: 103.4, size: 4.5 },
    longitud: { x: 115, y: 110.4, size: 4.5 },
    altura: { x: 115, y: 117.8, size: 4.5 },
    ancho: { x: 115, y: 125, size: 4.5 },
    cilindrada: { x: 203, y: 103.4, size: 4.5 },
    pBruto: { x: 203, y: 110.7, size: 4.5 },
    pNeto: { x: 203, y: 117.8, size: 4.5 },
    cargaUtil: { x: 203, y: 125, size: 4.5 },

    // Código del reverso
    pdf417: { x: 10, y: 131.7, width: 170, height: 22 }
};

module.exports = {
    layout: 'electronicoPvcV2',
    plantillas,
    recorte,
    anverso,
    reverso
};
