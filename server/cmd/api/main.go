package main

import (
	"log"

	"github.com/gin-gonic/gin"
	"github.com/xsnbb/server/internal/config"
	"github.com/xsnbb/server/internal/router"
)

func main() {
	cfg := config.Load()
	if cfg.Env == "prod" {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.New()
	r.Use(gin.Recovery())

	router.Register(r, cfg)

	log.Printf("xsnbb api listening on %s (env=%s)", cfg.HTTPAddr, cfg.Env)
	if err := r.Run(cfg.HTTPAddr); err != nil {
		log.Fatal(err)
	}
}
