export interface AppConfig {
  name: string
  port: number
}

const config: AppConfig = {
  name: 'Amphion Playground',
  port: Number(process.env.PORT ?? 3000),
}

export default config
