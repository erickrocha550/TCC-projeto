tailwind.config = {
            theme: {
                extend: {
                    colors: {
                        // Paleta adaptada da logo (Verde Circuito / Folha)
                        brand: {
                            50: '#ecfdf5',
                            100: '#d1fae5',
                            500: '#10b981',
                            600: '#059669',
                            700: '#047857', // Verde principal
                            900: '#064e3b',
                        },
                        // Cor adaptada do Pino de Localização
                        accent: {
                            500: '#f59e0b',
                            600: '#d97706',
                        },
                        urgency: {
                            low: '#10b981',
                            medium: '#f59e0b',
                            critical: '#ef4444'
                        }
                    },
                    fontFamily: {
                        sans: ['Inter', 'sans-serif'],
                    }
                }
            }
        }