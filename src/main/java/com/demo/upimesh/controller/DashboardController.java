package com.demo.upimesh.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class DashboardController {

    /**
     * Serves the super simple, intuitive Live Demo Dashboard at root (/).
     */
    @GetMapping("/")
    public String home() {
        return "dashboard";
    }

    /**
     * Preserves /classic pointing to the same simple live demo.
     */
    @GetMapping("/classic")
    public String classic() {
        return "dashboard";
    }

    /**
     * Serves the advanced React Fintech Workbench at /workbench.
     */
    @GetMapping("/workbench")
    public String workbench() {
        return "forward:/index.html";
    }
}
