package com.fixme.infrastructure.config;
import com.fixme.application.*; import org.springframework.context.annotation.*;
@Configuration public class CashConfig { @Bean CashService cashService(CashPort p,ModuleService m){return new CashService(p,m);} }
