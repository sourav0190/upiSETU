package com.demo.upimesh.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class DashboardController {

    /**
     * Serves the modern, unified MeshPay React application at root (/).
     */
    @GetMapping("/")
    public String home() {
        return "forward:/index.html";
    }

    /**
     * Consolidates routing: redirects /workbench to the primary experience at /.
     */
    @GetMapping("/workbench")
    public String workbench() {
        return "redirect:/";
    }

    /**
     * Preserves the classic Thymeleaf developer dashboard at /classic.
     */
    @GetMapping("/classic")
    public String classic() {
        return "dashboard";
    }
}

