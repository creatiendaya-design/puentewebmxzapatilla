/**
 * Netlify Function: submit-registro
 * Versión corregida con manejo CORS mejorado
 */

const fetch = require('node-fetch');

// Headers CORS que se usarán en todas las respuestas
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Accept',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400', // 24 horas
};

exports.handler = async (event, context) => {
  // Manejar preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }

  // Solo permitir método POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      },
      body: JSON.stringify({ 
        success: false, 
        message: 'Método no permitido. Use POST.' 
      })
    };
  }

  try {
    // URL del Google Apps Script
    const GOOGLE_SCRIPT_URL = process.env.GOOGLE_SCRIPT_URL;

    if (!GOOGLE_SCRIPT_URL) {
      throw new Error('GOOGLE_SCRIPT_URL no configurada en las variables de entorno');
    }

    // Parsear datos del body
    let data;
    try {
      data = JSON.parse(event.body);
    } catch (e) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        },
        body: JSON.stringify({
          success: false,
          message: 'JSON inválido en el body'
        })
      };
    }

    // Validar datos requeridos
    if (!data.nombre || !data.email || !data.whatsapp) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        },
        body: JSON.stringify({
          success: false,
          message: 'Faltan campos requeridos: nombre, email y whatsapp son obligatorios'
        })
      };
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        },
        body: JSON.stringify({
          success: false,
          message: 'Formato de email inválido'
        })
      };
    }

    // Agregar información adicional
    const enrichedData = {
      nombre: data.nombre.trim(),
      email: data.email.trim().toLowerCase(),
      whatsapp: data.whatsapp.trim(),
      producto: data.producto || 'Lanzamiento',
      productoId: data.productoId || '',
      productoHandle: data.productoHandle || '',
      productoPrice: data.productoPrice || '',
      productoImage: data.productoImage || '',
      ip: event.headers['x-forwarded-for'] || event.headers['client-ip'] || 'Unknown',
      userAgent: event.headers['user-agent'] || 'Unknown',
      fecha: new Date().toISOString(),
      origen: event.headers['origin'] || event.headers['referer'] || 'Unknown'
    };

    console.log('Enviando datos a Google Apps Script:', {
      email: enrichedData.email,
      producto: enrichedData.producto
    });

    // Enviar a Google Apps Script
    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(enrichedData),
      redirect: 'follow'
    });

    const responseText = await response.text();
    console.log('Respuesta de Google:', responseText);

    let result;
    try {
      result = JSON.parse(responseText);
    } catch (e) {
      console.error('Error parsing Google response:', responseText);
      throw new Error('Respuesta inválida de Google Apps Script');
    }

    // Validar respuesta de Google
    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Error al guardar en Google Sheets');
    }

    // Retornar éxito
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      },
      body: JSON.stringify({
        success: true,
        message: 'Registro guardado exitosamente',
        timestamp: enrichedData.fecha
      })
    };

  } catch (error) {
    console.error('Error en submit-registro:', error);

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      },
      body: JSON.stringify({
        success: false,
        message: 'Error al procesar el registro',
        error: error.message
      })
    };
  }
};
