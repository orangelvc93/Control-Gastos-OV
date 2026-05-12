import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';

export function startHelpTour() {
  driver({
    showProgress: true,
    nextBtnText: 'Siguiente',
    prevBtnText: 'Anterior',
    doneBtnText: 'Listo',
    steps: [
      {
        element: '[data-tour="header"]',
        popover: {
          title: 'Centro de control',
          description: 'Aqui ves el estado de sincronizacion con Supabase y puedes restaurar la base inicial.',
        },
      },
      {
        element: '[data-tour="nav"]',
        popover: {
          title: 'Menu principal',
          description: 'Cambia entre Dashboard, movimientos, ahorros, deudas y presupuesto.',
        },
      },
      {
        element: '[data-tour="workspace"]',
        popover: {
          title: 'Area de trabajo',
          description: 'Cada seccion permite crear, editar o eliminar informacion. Los cambios se guardan automaticamente en Supabase.',
        },
      },
      {
        element: '[data-tour="help"]',
        popover: {
          title: 'Ayuda guiada',
          description: 'Puedes volver a ejecutar este recorrido cuando necesites recordar el flujo.',
        },
      },
    ],
  }).drive();
}
