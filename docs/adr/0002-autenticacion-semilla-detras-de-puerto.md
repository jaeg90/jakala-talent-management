# 0002: Autenticación con usuarios semilla, aislada tras un puerto

Para el MVP del TFM, los managers se identifican con email y contraseña contra usuarios precargados en la semilla: sin registro ni recuperación de contraseña.

La comprobación de credenciales se aísla tras un puerto de la arquitectura hexagonal: es un adaptador intercambiable. Motivo: si la herramienta se aprueba en el futuro, la empresa usa el inicio de sesión de Microsoft (Entra ID), y el cambio debe ser un adaptador nuevo sin tocar el dominio ni la aplicación.
