/**
 * Netlify Function: submit-registro
 * Actúa como puente entre Shopify y Google Apps Script
 * Evita problemas de CORS y agrega información adicional
 * 
 * INSTALACIÓN:
 * 1. Crea una carpeta "netlify/functions" en tu proyecto
 * 2. Guarda este archivo como "submit-registro.js"
 * 3. Configura la variable de entorno GOOGLE_SCRIPT_URL en Netlify
 * 4. Deploy a Netlify
 */

const fetch = require('node-fetch');

exports.handler = async (event, context) => {
  // Solo permitir método POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: JSON.stringify({ 
        success: false, 
        message: 'Método no permitido' 
      })
    };
  }

  // Manejar preflight CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  try {
    // URL del Google Apps Script
    const GOOGLE_SCRIPT_URL = process.env.GOOGLE_SCRIPT_URL;

    if (!GOOGLE_SCRIPT_URL) {
      throw new Error('GOOGLE_SCRIPT_URL no configurada');
    }

    // Parsear datos del body
    const data = JSON.parse(event.body);

    // Validar datos requeridos
    if (!data.nombre || !data.email || !data.whatsapp) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          message: 'Faltan campos requeridos'
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
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          message: 'Email inválido'
        })
      };
    }

    // Agregar información adicional
    const enrichedData = {
      ...data,
      ip: event.headers['x-forwarded-for'] || event.headers['client-ip'] || 'Unknown',
      userAgent: event.headers['user-agent'] || 'Unknown',
      fecha: new Date().toISOString()
    };

    // Enviar a Google Apps Script
    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(enrichedData)
    });

    const result = await response.json();

    // Validar respuesta de Google
    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Error al guardar en Google Sheets');
    }

    // Retornar éxito
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
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
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: false,
        message: 'Error al procesar el registro',
        error: error.message
      })
    };
  }
};
